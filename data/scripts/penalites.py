"""Entraves converties en pénalités de temps vers data/out/penalites.json.

Règle choisie par l'équipe (valeurs de démo, pas des données de la Ville) : pour chaque paire de
points, si le segment à vol d'oiseau passe à moins de RAYON_M d'un permis, on ajoute la pénalité
du permis au temps de trajet. Un arrêt à moins de RAYON_M d'une rue barrée reçoit aussi sa
pénalité.
"""

import json
import math
from datetime import date
from pathlib import Path

import numpy as np

from scripts import quartier
from scripts.chantiers import RESSOURCE as RESSOURCE_ENTRAVES
from scripts.sql import requete_sql

OUT = Path(__file__).resolve().parent.parent / "out"
SORTIE = OUT / "penalites.json"
MATRICE = OUT / "matrice.json"
RESSOURCE_IMPACTS = "a2bc8014-488c-495d-941b-e7ae1999d1bd"

# 75 m pénalisait 81 % des paires (le segment à vol d'oiseau croise des permis presque partout) :
# la pénalité moyenne dépassait le trajet moyen. 30 m en pénalise 56 %, moyenne 163 s pour 281 s.
RAYON_M = 30
PLAFOND_PAIRE_S = 600
PENALITE_PAR_TYPE = {
    "Rue barrée": 300,
    "Voie de circulation obstruée": 120,
    "Voie de stationnement et voie de circulation obstruées": 120,
    "Voie de stationnement obstruée": 0,
    "Aucun impact / non applicable": 0,
}
MARGE_DEG = 0.002


def requete(aujourdhui: date) -> str:
    jour = aujourdhui.isoformat()
    return (
        'SELECT e."id" AS id_permis, e."permit_permit_id" AS permis, '
        'e."organizationname" AS entreprise, e."latitude" AS latitude, e."longitude" AS longitude, '
        'i."streetimpacttype" AS impact, i."name" AS rue, i."fromname" AS de, i."toname" AS a '
        f'FROM "{RESSOURCE_IMPACTS}" i JOIN "{RESSOURCE_ENTRAVES}" e ON e."id"=i."id_request" '
        f'WHERE e."latitude"::numeric BETWEEN {quartier.LAT_MIN - MARGE_DEG} '
        f"AND {quartier.LAT_MAX + MARGE_DEG} "
        f'AND e."longitude"::numeric BETWEEN {quartier.LNG_MIN - MARGE_DEG} '
        f"AND {quartier.LNG_MAX + MARGE_DEG} "
        f"AND e.\"duration_start_date\" <= '{jour}' AND e.\"duration_end_date\" >= '{jour}' "
        "LIMIT 32000"
    )


def regrouper_permis(lignes: list[dict]) -> list[dict]:
    """Un permis par identifiant, avec la pire pénalité de ses tronçons. Garde ceux > 0."""
    permis: dict[str, dict] = {}
    for ligne in lignes:
        penalite = PENALITE_PAR_TYPE.get(ligne["impact"], 0)
        p = permis.setdefault(
            ligne["permis"],
            {
                "id": ligne["permis"],
                "entreprise": (ligne.get("entreprise") or "").strip() or None,
                "latitude": float(ligne["latitude"]),
                "longitude": float(ligne["longitude"]),
                "type_impact": ligne["impact"],
                "penalite_s": 0,
                "rues": [],
            },
        )
        if penalite > p["penalite_s"]:
            p["penalite_s"], p["type_impact"] = penalite, ligne["impact"]
        if ligne.get("rue") and ligne["rue"] not in p["rues"]:
            p["rues"].append(ligne["rue"])
    return sorted((p for p in permis.values() if p["penalite_s"] > 0), key=lambda p: p["id"])


def _xy(lat: np.ndarray, lng: np.ndarray, lat0: float) -> tuple[np.ndarray, np.ndarray]:
    return lng * 111_320 * math.cos(math.radians(lat0)), lat * 110_574


def distance_points_segments(px: float, py: float, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Distance (m) du point P à chaque segment i->j, en matrice n x n."""
    ax, ay = x[:, None], y[:, None]
    dx, dy = x[None, :] - ax, y[None, :] - ay
    longueur2 = dx * dx + dy * dy
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(longueur2 > 0, ((px - ax) * dx + (py - ay) * dy) / longueur2, 0.0)
    t = np.clip(t, 0, 1)
    return np.hypot(px - (ax + t * dx), py - (ay + t * dy))


def calculer(points: list[dict], permis: list[dict]) -> tuple[list[list[int]], dict[str, int]]:
    """Matrice de pénalités (s) et pénalité par arrêt (rue barrée proche)."""
    lat = np.array([p["latitude"] for p in points])
    lng = np.array([p["longitude"] for p in points])
    lat0 = float(lat.mean())
    x, y = _xy(lat, lng, lat0)
    total = np.zeros((len(points), len(points)))
    par_arret = np.zeros(len(points))
    for p in permis:
        px, py = _xy(np.array(p["latitude"]), np.array(p["longitude"]), lat0)
        proche = distance_points_segments(float(px), float(py), x, y) <= RAYON_M
        np.fill_diagonal(proche, False)
        total += proche * p["penalite_s"]
        if p["type_impact"] == "Rue barrée":
            près = np.hypot(float(px) - x, float(py) - y) <= RAYON_M
            par_arret = np.maximum(par_arret, près * p["penalite_s"])
    total = np.minimum(total, PLAFOND_PAIRE_S)
    matrice = [[int(v) for v in ligne] for ligne in total]
    arrets = {
        pt["id"]: int(par_arret[i])
        for i, pt in enumerate(points)
        if pt["type"] == "arret" and par_arret[i] > 0
    }
    return matrice, arrets


def main() -> None:
    points = json.loads(MATRICE.read_text("utf-8"))["points"]
    aujourdhui = date.today()
    permis = regrouper_permis(requete_sql(requete(aujourdhui)))
    matrice, arrets = calculer(points, permis)
    sortie = {
        "date": aujourdhui.isoformat(),
        "regle": {
            "rayon_m": RAYON_M,
            "penalite_par_type_s": PENALITE_PAR_TYPE,
            "plafond_paire_s": PLAFOND_PAIRE_S,
            "note": "Valeurs de démo choisies par l'équipe, pas des données de la Ville.",
        },
        "sources": [RESSOURCE_ENTRAVES, RESSOURCE_IMPACTS],
        "points": [p["id"] for p in points],
        "penalites_s": matrice,
        "penalite_arret_s": arrets,
        "permis": permis,
    }
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), "utf-8")
    nb = sum(1 for ligne in matrice for v in ligne if v)
    print(
        f"{len(permis)} permis, {nb} paires pénalisées, {len(arrets)} arrêts, {SORTIE.stat().st_size} octets"
    )


if __name__ == "__main__":
    main()
