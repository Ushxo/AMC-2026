"""Rattache chaque avis d'eau aux tronçons de rue qu'il touche, vers data/out/avis-eau-troncons.json.

Les polygones de avis-eau.json viennent, pour la plupart, de lignes du jeu « Avis et alertes » élargies de
30 m de part et d'autre : ils débordent des rues. Ce fichier donne, pour chaque avis, la forme officielle
et les tronçons de la Géobase qu'il touche, pour dessiner les rues en trait épais.

Format de avis-eau-troncons.json :

    {
      "version": 1,
      "tolerance_m": 25,
      "avis": [
        { "id": "498", "forme": "ligne" | "point" | "polygone",
          "troncons": [1010001, ...],        // identifiants (ID_TRC) de troncons.json
          "rues": ["rue Guy", ...],          // libellés des tronçons touchés
          "trace": [[lng, lat], ...] | null, // forme « ligne » : la ligne officielle
          "polygone": { GeoJSON } | null,    // forme « polygone » : le secteur officiel, sans l'arrondir
          "point": [lng, lat] | null }       // forme « point » : l'adresse
      ]
    }

Règles : un tronçon est touché par une ligne si au moins la moitié du tronçon est à moins de 25 m de la
ligne, ou si au moins 70 % de la ligne est à moins de 25 m du tronçon ; on garde la rue la plus touchée et,
pour les autres rues, seulement les tronçons touchés à 90 % et longs d'au moins 40 m (pas les bouts de rue
transversale aux carrefours). Un point est rattaché au tronçon le
plus proche (à 60 m au plus) qui porte le nom de rue de l'adresse du titre, sinon au plus proche (à 40 m
au plus). Un polygone officiel garde sa forme ; ses tronçons sont ceux qui sont à moitié dedans au moins (ou dont la
part dans le secteur couvre 70 % de sa plus grande dimension), avec le même tri des rues.
Forme sans tronçon trouvé : `troncons` est vide, l'app garde alors la forme officielle.
"""

import json
import math
import re
from pathlib import Path

import numpy as np
from shapely import transform as shp_transform
from shapely.geometry import LineString, Point, shape

from scripts import avis_eau
from scripts.reseau_routier import (
    M_PAR_DEG_LAT,
    M_PAR_DEG_LNG_EQ,
    normaliser,
    troncon_le_plus_proche,
)
from scripts.sql import telecharger_json

OUT = Path(__file__).resolve().parent.parent / "out"
SORTIE = OUT / "avis-eau-troncons.json"
TOLERANCE_M = 25.0
FRACTION_TRONCON = 0.5
FRACTION_LIGNE = 0.7
RAYON_POINT_NOMME_M = 60.0
RAYON_POINT_M = 40.0


def _projeter(coords, lat0: float):
    k = math.cos(math.radians(lat0)) * M_PAR_DEG_LNG_EQ
    return [(x * k, y * M_PAR_DEG_LAT) for x, y in coords]


def _geom_metres(g: dict, lat0: float):
    """Géométrie GeoJSON (Point, LineString, Polygon, MultiPolygon) en mètres autour de `lat0`."""
    k = math.cos(math.radians(lat0)) * M_PAR_DEG_LNG_EQ
    if g["type"] == "Point":
        return Point(g["coordinates"][0] * k, g["coordinates"][1] * M_PAR_DEG_LAT)
    brut = shape(g)
    return shp_transform(brut, lambda a: a * np.array([k, M_PAR_DEG_LAT]))


def nom_de_rue(libelle: str) -> str:
    """« 1700 avenue du Docteur-Penfield » devient « avenue du docteur-penfield »."""
    sans_numero = re.sub(r"^\s*\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?\s+", "", libelle)
    return normaliser(sans_numero)


SECTEUR_MIN_M = 15.0
LONGUEUR_MIN_AUTRE_RUE_M = 40.0
FRACTION_AUTRE_RUE = 0.9


def _retenir(candidats: list[dict]) -> list[dict]:
    """Garde la rue principale (celle dont la longueur touchée est la plus grande) et, pour les autres rues,
    seulement les tronçons presque entièrement touchés et assez longs : les petits bouts de rue transversale
    aux carrefours ne sont pas dans la zone."""
    if not candidats:
        return []
    par_nom: dict[str, float] = {}
    for c in candidats:
        par_nom[c["t"]["nom"]] = par_nom.get(c["t"]["nom"], 0.0) + c["touche_m"]
    principale = max(par_nom, key=lambda n: par_nom[n])
    return [
        c["t"]
        for c in candidats
        if c["t"]["nom"] == principale
        or (c["part_troncon"] >= FRACTION_AUTRE_RUE and c["longueur_m"] >= LONGUEUR_MIN_AUTRE_RUE_M)
    ]


def tronçons_ligne(trace: list[list[float]], reseau: dict, lat0: float) -> list[dict]:
    ligne = LineString(_projeter(trace, lat0))
    if ligne.length == 0:
        return []
    zone = ligne.buffer(TOLERANCE_M)
    candidats = []
    for t in reseau["troncons"]:
        tr = LineString(_projeter(t["points"], lat0))
        if not tr.length or not tr.intersects(zone):
            continue
        touche = tr.intersection(zone).length
        part_troncon = touche / tr.length
        part_ligne = ligne.intersection(tr.buffer(TOLERANCE_M)).length / ligne.length
        if part_troncon >= FRACTION_TRONCON or part_ligne >= FRACTION_LIGNE:
            candidats.append(
                {"t": t, "touche_m": touche, "part_troncon": part_troncon, "longueur_m": tr.length}
            )
    return _retenir(candidats)


def tronçons_polygone(g: dict, reseau: dict, lat0: float) -> list[dict]:
    """Tronçons à moitié dans le secteur, ou dont la part dans le secteur couvre l'essentiel de sa longueur."""
    poly = _geom_metres(g, lat0)
    rect = list(poly.minimum_rotated_rectangle.exterior.coords)
    cotes = [math.dist(rect[i], rect[i + 1]) for i in range(4)]
    longueur_secteur = max(cotes) if cotes else 0.0
    candidats = []
    touchent = []
    for t in reseau["troncons"]:
        tr = LineString(_projeter(t["points"], lat0))
        if not tr.length or not tr.intersects(poly):
            continue
        touche = tr.intersection(poly).length
        part_troncon = touche / tr.length
        part_secteur = touche / longueur_secteur if longueur_secteur else 0.0
        element = {
            "t": t,
            "touche_m": touche,
            "part_troncon": part_troncon,
            "longueur_m": tr.length,
        }
        touchent.append(element)
        if part_troncon >= FRACTION_TRONCON or part_secteur >= FRACTION_LIGNE:
            candidats.append(element)
    if not candidats and touchent:
        # Petit secteur qui ne couvre qu'un morceau de rue : le tronçon le plus traversé, s'il l'est assez.
        meilleur = max(touchent, key=lambda c: c["touche_m"])
        if meilleur["touche_m"] >= SECTEUR_MIN_M:
            candidats = [meilleur]
    return _retenir(candidats)


def troncon_point(lng: float, lat: float, reseau: dict, rue: str | None) -> list[dict]:
    if rue:
        proche = troncon_le_plus_proche(reseau, lat, lng, nom=rue)
        if proche and proche[1] <= RAYON_POINT_NOMME_M:
            return [proche[0]]
    proche = troncon_le_plus_proche(reseau, lat, lng)
    return [proche[0]] if proche and proche[1] <= RAYON_POINT_M else []


def _arrondir(coords: list, n: int = 6):
    if coords and isinstance(coords[0], (int, float)):
        return [round(c, n) for c in coords]
    return [_arrondir(c, n) for c in coords]


def rattacher(avis: dict, source: dict, reseau: dict, adresses: list[dict]) -> list[dict]:
    """Une entrée par avis de `avis` (FeatureCollection de avis-eau.geojson), forme officielle prise dans
    `source` (le GeoJSON du jeu « Avis et alertes »). Un avis introuvable dans la source est ignoré."""
    par_cle = {
        ((f["properties"].get("titre") or "").strip(), f["properties"].get("date_debut")): f
        for f in source["features"]
    }
    resultat = []
    for f in avis["features"]:
        p = f["properties"]
        origine = par_cle.get((p["titre"], p["debut"]))
        if origine is None or not origine.get("geometry"):
            continue
        g = origine["geometry"]
        lat0 = reseau["grille"]["latitudeMin"]
        entree = {
            "id": p["id"],
            "forme": None,
            "troncons": [],
            "rues": [],
            "trace": None,
            "polygone": None,
            "point": None,
        }
        if g["type"] == "LineString":
            entree["forme"] = "ligne"
            entree["trace"] = _arrondir(g["coordinates"])
            retenus = tronçons_ligne(g["coordinates"], reseau, lat0)
        elif g["type"] == "Point":
            entree["forme"] = "point"
            entree["point"] = _arrondir(g["coordinates"][:2])
            adresse = avis_eau.adresse_du_titre(p["titre"], adresses)
            rue = nom_de_rue(adresse["libelle"]) if adresse else None
            retenus = troncon_point(g["coordinates"][0], g["coordinates"][1], reseau, rue)
        elif g["type"] in ("Polygon", "MultiPolygon"):
            entree["forme"] = "polygone"
            entree["polygone"] = {"type": g["type"], "coordinates": _arrondir(g["coordinates"])}
            retenus = tronçons_polygone(g, reseau, lat0)
        else:
            continue
        entree["troncons"] = [t["id"] for t in retenus]
        entree["rues"] = sorted({t["libelle"] for t in retenus})
        resultat.append(entree)
    return resultat


def main() -> None:
    reseau = json.loads((OUT / "troncons.json").read_text("utf-8"))
    avis = json.loads((OUT / "avis-eau.geojson").read_text("utf-8"))
    adresses = json.loads((OUT / "adresses.json").read_text("utf-8"))
    entrees = rattacher(avis, telecharger_json(avis_eau.URL_GEOJSON), reseau, adresses)
    sortie = {"version": 1, "tolerance_m": TOLERANCE_M, "avis": entrees}
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), "utf-8")
    for e in entrees:
        print(e["id"], e["forme"], len(e["troncons"]), e["rues"][:4])
    print(f"{len(entrees)} avis -> {SORTIE} ({SORTIE.stat().st_size} octets)")


if __name__ == "__main__":
    main()
