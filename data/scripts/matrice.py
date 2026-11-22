"""Matrice des temps de trajet (OSRM) entre garages et arrêts vers data/out/matrice.json.

L'appel au serveur public se fait une seule fois : le fichier sert ensuite de cache.
"""

import argparse
import json
import math
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

from scripts import equipes
from scripts.portail import USER_AGENT

OUT = Path(__file__).resolve().parent.parent / "out"
SORTIE = OUT / "matrice.json"
GRILLES = OUT / "grilles.geojson"
SIGNALEMENTS = OUT / "signalements-demo.json"

URL_OSRM = "https://router.project-osrm.org/table/v1/driving/"
TAILLE_BLOC = 48  # deux blocs = 96 coordonnées par requête, sous la limite supposée de 100
PAUSE_S = 1.1  # au plus une requête par seconde
ESSAIS = 3
# Repli : distance à vol d'oiseau, détour de 30 %, 30 km/h en ville.
DETOUR = 1.3
VITESSE_MS = 30 / 3.6


def distance_vol_m(a: dict, b: dict) -> float:
    """Distance à vol d'oiseau en mètres (haversine)."""
    p1, p2 = math.radians(a["latitude"]), math.radians(b["latitude"])
    dl = math.radians(b["longitude"] - a["longitude"])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def construire_points(grilles: dict, signalements: list[dict]) -> list[dict]:
    """Garages d'abord, puis un arrêt par puisard signalé et ouvert, triés par identifiant."""
    position = {f["properties"]["id"]: f["geometry"]["coordinates"] for f in grilles["features"]}
    ouverts = {
        s["grille_id"]
        for s in signalements
        if s["grille_id"] and s["etat"] in ("nouveau", "pris_en_charge")
    }
    points = [
        {
            "id": g["id"],
            "type": "garage",
            "latitude": g["latitude"],
            "longitude": g["longitude"],
        }
        for g in equipes.garages(grilles)
    ]
    for ident in sorted(ouverts):
        lng, lat = position[ident]
        points.append({"id": ident, "type": "arret", "latitude": lat, "longitude": lng})
    return points


def demander_bloc(client: httpx.Client, bloc_a: list[dict], bloc_b: list[dict]) -> dict | None:
    """Table OSRM sources=bloc_a, destinations=bloc_b. Rend None si les essais échouent."""
    meme = bloc_a is bloc_b
    coords = bloc_a if meme else bloc_a + bloc_b
    chemin = ";".join(f"{p['longitude']},{p['latitude']}" for p in coords)
    na = len(bloc_a)
    sources = ";".join(str(i) for i in range(na))
    destinations = (
        ";".join(str(i) for i in range(len(bloc_b)))
        if meme
        else ";".join(str(na + i) for i in range(len(bloc_b)))
    )
    url = (
        f"{URL_OSRM}{chemin}?annotations=duration,distance"
        f"&sources={sources}&destinations={destinations}"
    )
    for essai in range(ESSAIS):
        try:
            reponse = client.get(url, timeout=60)
            if reponse.status_code == 200 and reponse.json().get("code") == "Ok":
                return reponse.json()
        except httpx.HTTPError:
            pass
        time.sleep(PAUSE_S * (2**essai))
    return None


def construire(points: list[dict], client: httpx.Client | None = None, pause: float = PAUSE_S):
    """Matrices de durées (s) et de distances (m), entiers, non symétriques."""
    n = len(points)
    durees = [[0] * n for _ in range(n)]
    distances = [[0] * n for _ in range(n)]
    blocs = [points[i : i + TAILLE_BLOC] for i in range(0, n, TAILLE_BLOC)]
    repli_cellules = 0
    blocs_repli = []
    derniere = 0.0
    for ia, a in enumerate(blocs):
        for ib, b in enumerate(blocs):
            reponse = None
            if client is not None:
                attente = pause - (time.monotonic() - derniere)
                if attente > 0:
                    time.sleep(attente)
                reponse = demander_bloc(client, a, b if ib != ia else a)
                derniere = time.monotonic()
            if reponse is None:
                blocs_repli.append([ia, ib])
            for i, pa in enumerate(a):
                for j, pb in enumerate(b):
                    gi, gj = ia * TAILLE_BLOC + i, ib * TAILLE_BLOC + j
                    d = reponse["durations"][i][j] if reponse else None
                    m = reponse["distances"][i][j] if reponse else None
                    if d is None or m is None:
                        m = distance_vol_m(pa, pb) * DETOUR
                        d = m / VITESSE_MS
                        repli_cellules += 1
                    durees[gi][gj] = 0 if gi == gj else round(d)
                    distances[gi][gj] = 0 if gi == gj else round(m)
    return durees, distances, repli_cellules, blocs_repli


def charger_points() -> list[dict]:
    grilles = json.loads(GRILLES.read_text("utf-8"))
    signalements = json.loads(SIGNALEMENTS.read_text("utf-8"))
    return construire_points(grilles, signalements)


def cache_valide(points: list[dict]) -> bool:
    if not SORTIE.exists():
        return False
    ancien = json.loads(SORTIE.read_text("utf-8"))
    return [p["id"] for p in ancien["points"]] == [p["id"] for p in points]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="refaire l'appel à OSRM")
    parser.add_argument("--sans-reseau", action="store_true", help="vol d'oiseau seulement")
    args = parser.parse_args()
    points = charger_points()
    if cache_valide(points) and not args.force:
        print("Cache valide, aucun appel à OSRM.")
        return
    if args.sans_reseau:
        durees, distances, repli, blocs_repli = construire(points, None)
    else:
        with httpx.Client(headers={"User-Agent": USER_AGENT}) as client:
            durees, distances, repli, blocs_repli = construire(points, client)
    n = len(points)
    source = "vol_oiseau" if repli == n * n - n + n else ("mixte" if repli else "osrm")
    sortie = {
        "source": source,
        "serveur": "router.project-osrm.org" if source != "vol_oiseau" else None,
        "profil": "driving",
        "date": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "repli_vol_oiseau": {
            "cellules": repli,
            "blocs": blocs_repli,
            "regle": f"distance à vol d'oiseau x {DETOUR}, 30 km/h",
        },
        "points": points,
        "durees_s": durees,
        "distances_m": distances,
    }
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{n} points, source {source}, {repli} cellules en repli, {SORTIE.stat().st_size} octets")


if __name__ == "__main__":
    main()
