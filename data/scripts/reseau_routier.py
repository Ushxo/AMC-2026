"""Tronçons de rue du quartier de démo (Géobase, réseau routier) vers data/out/troncons.json.

Source : jeu « Géobase - réseau routier » du portail de données ouvertes de Montréal, ressource GeoJSON
9d3d60d8-4e7f-493e-8d6a-dcd040319d8d, licence Creative Commons Attribution 4.0 (CC BY 4.0).

Format de troncons.json (coordonnées WGS84, ordre [longitude, latitude] comme le GeoJSON) :

    {
      "version": 1,
      "source": { "nom", "ressource", "licence", "date" },
      "emprise": { "latitudeMin", "latitudeMax", "longitudeMin", "longitudeMax" },
      "grille": { "pas": 0.002, "latitudeMin", "longitudeMin" },
      "troncons": [ { "id": 1010001, "nom": "avenue adhemar-mailhiot",
                      "libelle": "avenue Adhémar-Mailhiot", "points": [[-73.5, 45.5], ...] } ],
      "cases": { "<ligne>_<colonne>": [indices dans « troncons » ] }
    }

`nom` est le nom de rue normalisé comme dans l'index d'adresses de l'app (sans numéro civique, sans
accents, en minuscules) ; `libelle` est le même nom pour l'affichage. Une case (ligne, colonne) est
`floor((latitude - latitudeMin) / pas)` et `floor((longitude - longitudeMin) / pas)`. Un tronçon est
rangé dans toutes les cases que sa boîte englobante touche. Chercher le tronçon le plus proche d'un point :
prendre la case du point et ses 8 voisines (un tronçon à moins de 150 m du point y figure toujours), puis
le tronçon dont la polyligne est la plus proche.
"""

import itertools
import json
import math
import unicodedata
from datetime import date
from pathlib import Path

from shapely.geometry import LineString, box

from scripts import quartier
from scripts.sql import telecharger_json

RESSOURCE = "9d3d60d8-4e7f-493e-8d6a-dcd040319d8d"
URL = (
    "https://donnees.montreal.ca/dataset/984f7a68-ab34-4092-9204-4bdfcca767c5/resource/"
    f"{RESSOURCE}/download/geobase.json"
)
OUT = Path(__file__).resolve().parent.parent / "out"
SORTIE = OUT / "troncons.json"

PAS_GRILLE = 0.002
TOLERANCE_M = 2.0
MARGE_LAT = 0.0027  # environ 300 m
MARGE_LNG = 0.0039
M_PAR_DEG_LAT = 110_574.0
M_PAR_DEG_LNG_EQ = 111_320.0
TAILLE_MAX = 1_500_000


def normaliser(texte: str) -> str:
    """Même règle que `normaliser` de l'app : sans accents, en minuscules, sans espaces au bord."""
    base = unicodedata.normalize("NFD", texte)
    return "".join(c for c in base if unicodedata.category(c) != "Mn").lower().strip()


def libelle(props: dict) -> str:
    """« rue du Shannon », « rue Sainte-Catherine Ouest » : type, liaison, nom, direction."""
    morceaux = [
        props.get("TYP_VOIE"),
        props.get("LIE_VOIE"),
        props.get("NOM_VOIE"),
        props.get("DIR_VOIE"),
    ]
    return " ".join(m.strip() for m in morceaux if m and m.strip())


def nom_normalise(props: dict) -> str:
    return normaliser(libelle(props))


def emprise_donnees(dossier: Path = OUT) -> dict[str, float]:
    """Boîte qui couvre le quartier de démo, les grilles, les signalements et les avis d'eau, avec une marge."""
    lat = [quartier.LAT_MIN, quartier.LAT_MAX]
    lng = [quartier.LNG_MIN, quartier.LNG_MAX]

    def ajouter_geometrie(g: dict | None) -> None:
        if not g:
            return
        pts = _points(g)
        lat.extend(p[1] for p in pts)
        lng.extend(p[0] for p in pts)

    for nom in ("grilles.geojson", "avis-eau.geojson"):
        chemin = dossier / nom
        if chemin.exists():
            for f in json.loads(chemin.read_text("utf-8"))["features"]:
                ajouter_geometrie(f["geometry"])
    chemin = dossier / "signalements-demo.json"
    if chemin.exists():
        for s in json.loads(chemin.read_text("utf-8")):
            lat.append(s["latitude"])
            lng.append(s["longitude"])
    return {
        "latitudeMin": round(min(lat) - MARGE_LAT, 6),
        "latitudeMax": round(max(lat) + MARGE_LAT, 6),
        "longitudeMin": round(min(lng) - MARGE_LNG, 6),
        "longitudeMax": round(max(lng) + MARGE_LNG, 6),
    }


def _points(g: dict) -> list[list[float]]:
    t, c = g["type"], g["coordinates"]
    if t == "Point":
        return [c]
    if t == "LineString":
        return c
    if t == "Polygon":
        return [p for anneau in c for p in anneau]
    if t == "MultiPolygon":
        return [p for poly in c for anneau in poly for p in anneau]
    return []


def simplifier(points: list[list[float]], tolerance_m: float = TOLERANCE_M) -> list[list[float]]:
    """Simplifie une polyligne (Douglas-Peucker) à `tolerance_m` près, arrondie à 6 décimales.
    Les extrémités sont gardées."""
    if len(points) <= 2:
        return [[round(x, 6), round(y, 6)] for x, y in points]
    lat0 = sum(p[1] for p in points) / len(points)
    k = math.cos(math.radians(lat0)) * M_PAR_DEG_LNG_EQ
    en_metres = LineString([(x * k, y * M_PAR_DEG_LAT) for x, y in points])
    simple = en_metres.simplify(tolerance_m, preserve_topology=False)
    return [[round(x / k, 6), round(y / M_PAR_DEG_LAT, 6)] for x, y in simple.coords]


def construire(source: dict, emprise: dict[str, float], tolerance_m: float = TOLERANCE_M) -> dict:
    """Tronçons nommés dont la boîte touche l'emprise, simplifiés, avec leur grille de recherche."""
    zone = box(
        emprise["longitudeMin"],
        emprise["latitudeMin"],
        emprise["longitudeMax"],
        emprise["latitudeMax"],
    )
    troncons = []
    for f in source["features"]:
        p, g = f["properties"], f.get("geometry")
        if not g or g["type"] != "LineString" or not libelle(p):
            continue
        if not zone.intersects(LineString(g["coordinates"])):
            continue
        points = simplifier(g["coordinates"], tolerance_m)
        if len(points) < 2 or points[0] == points[-1] and len(points) == 2:
            continue
        troncons.append(
            {
                "id": int(p["ID_TRC"]),
                "nom": nom_normalise(p),
                "libelle": libelle(p),
                "points": points,
            }
        )
    troncons.sort(key=lambda t: t["id"])
    cases = grille(troncons, emprise["latitudeMin"], emprise["longitudeMin"])
    return {
        "version": 1,
        "source": {
            "nom": "Géobase - réseau routier",
            "ressource": RESSOURCE,
            "licence": "Creative Commons Attribution 4.0 (CC BY 4.0), Ville de Montréal",
            "date": date.today().isoformat(),
        },
        "emprise": emprise,
        "grille": {
            "pas": PAS_GRILLE,
            "latitudeMin": emprise["latitudeMin"],
            "longitudeMin": emprise["longitudeMin"],
        },
        "troncons": troncons,
        "cases": cases,
    }


def grille(troncons: list[dict], lat_min: float, lng_min: float) -> dict[str, list[int]]:
    """Chaque tronçon est rangé dans toutes les cases que la boîte de chacun de ses segments touche."""
    cases: dict[str, list[int]] = {}
    for indice, t in enumerate(troncons):
        touchees: set[tuple[int, int]] = set()
        for (x1, y1), (x2, y2) in itertools.pairwise(t["points"]):
            for i in range(
                math.floor((min(y1, y2) - lat_min) / PAS_GRILLE),
                math.floor((max(y1, y2) - lat_min) / PAS_GRILLE) + 1,
            ):
                for j in range(
                    math.floor((min(x1, x2) - lng_min) / PAS_GRILLE),
                    math.floor((max(x1, x2) - lng_min) / PAS_GRILLE) + 1,
                ):
                    touchees.add((i, j))
        for i, j in touchees:
            cases.setdefault(f"{i}_{j}", []).append(indice)
    return dict(sorted(cases.items()))


def troncon_le_plus_proche(
    reseau: dict, latitude: float, longitude: float, nom: str | None = None
) -> tuple[dict, float] | None:
    """Le tronçon le plus proche d'un point (distance en mètres) parmi la case du point et ses 8 voisines ;
    avec `nom`, seulement les tronçons de ce nom de rue normalisé."""
    g = reseau["grille"]
    i = math.floor((latitude - g["latitudeMin"]) / g["pas"])
    j = math.floor((longitude - g["longitudeMin"]) / g["pas"])
    indices: set[int] = set()
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            indices.update(reseau["cases"].get(f"{i + di}_{j + dj}", []))
    k = math.cos(math.radians(latitude))
    meilleur: tuple[dict, float] | None = None
    for indice in indices:
        t = reseau["troncons"][indice]
        if nom is not None and t["nom"] != nom:
            continue
        d = _distance_polyligne_m(t["points"], latitude, longitude, k)
        if meilleur is None or d < meilleur[1]:
            meilleur = (t, d)
    return meilleur


def _distance_polyligne_m(points: list[list[float]], lat: float, lng: float, k: float) -> float:
    meilleure = math.inf
    px, py = 0.0, 0.0
    for (x1, y1), (x2, y2) in itertools.pairwise(points):
        ax, ay = (x1 - lng) * k * M_PAR_DEG_LNG_EQ, (y1 - lat) * M_PAR_DEG_LAT
        bx, by = (x2 - lng) * k * M_PAR_DEG_LNG_EQ, (y2 - lat) * M_PAR_DEG_LAT
        dx, dy = bx - ax, by - ay
        longueur2 = dx * dx + dy * dy
        t = (
            0.0
            if longueur2 == 0
            else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / longueur2))
        )
        meilleure = min(meilleure, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return meilleure


def main() -> None:
    emprise = emprise_donnees()
    reseau = construire(telecharger_json(URL), emprise)
    texte = json.dumps(reseau, ensure_ascii=False, separators=(",", ":"))
    SORTIE.write_text(texte, "utf-8")
    print(
        f"{len(reseau['troncons'])} tronçons, {len(reseau['cases'])} cases, "
        f"{len(texte.encode())} octets -> {SORTIE}"
    )
    if len(texte.encode()) > TAILLE_MAX:
        raise SystemExit("Fichier trop gros : restreindre l'emprise ou simplifier davantage.")


if __name__ == "__main__":
    main()
