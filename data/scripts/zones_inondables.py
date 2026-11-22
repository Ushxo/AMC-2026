"""Zones de vulnérabilité aux crues 2022 (toute l'île) vers data/out/zones-inondables.geojson."""

import json
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, mapping, shape

from scripts.sql import telecharger_json

RESSOURCE = "01afc867-11f2-4a3b-b77e-d5e9ee853c87"
URL = (
    "https://donnees.montreal.ca/fr/dataset/3603f75a-1963-4130-9fc5-ab3e7272211a/resource/"
    f"{RESSOURCE}/download/vulnerabilite-crues-polygones-simplifies-2022.geojson"
)
SORTIE = Path(__file__).resolve().parent.parent / "out" / "zones-inondables.geojson"
SOURCE = "Vulnérabilité aux crues, 2022"
# Classes gardées : modérée, élevée, majeure. Non significative et mineure se verraient comme un risque.
CLASSES_GARDEES = {"3", "4", "5"}
TAILLE_MAX = 1_000_000

# Tolérances essayées, en degrés (0,0001 degré vaut environ 10 m), jusqu'à passer sous 1 Mo.
TOLERANCES = [0.0001, 0.00015, 0.0002, 0.0003]
SURFACE_MIN = 1e-8  # degrés carrés, environ 100 m2


def simplifier(geom, tolerance: float):
    """Simplifie, arrondit et retire les très petites pièces. Rend un MultiPolygon ou None."""
    morceaux = []
    for poly in getattr(geom, "geoms", [geom]):
        s = poly.simplify(tolerance, preserve_topology=True)
        if s.is_empty or s.area < SURFACE_MIN:
            continue
        for p in getattr(s, "geoms", [s]):
            if isinstance(p, Polygon) and not p.is_empty:
                morceaux.append(p)
    return MultiPolygon(morceaux) if morceaux else None


def arrondir(g: dict, chiffres: int = 5) -> dict:
    def r(c):
        return (
            [round(c[0], chiffres), round(c[1], chiffres)]
            if isinstance(c[0], float)
            else [r(x) for x in c]
        )

    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def construire(source: dict, tolerance: float = TOLERANCES[0]) -> dict:
    """Une Feature par classe gardée (modérée, élevée, majeure)."""
    features = []
    for f in source["features"]:
        p = f["properties"]
        if p.get("CruesCl") not in CLASSES_GARDEES or not f.get("geometry"):
            continue
        geom = simplifier(shape(f["geometry"]), tolerance)
        if geom is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": arrondir(mapping(geom)),
                "properties": {
                    "id": f"crues-2022-{p['CruesCl']}",
                    "origine": "officiel",
                    "gravite": "moyenne",
                    "source": SOURCE,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    source = telecharger_json(URL)
    for tolerance in TOLERANCES:
        texte = json.dumps(construire(source, tolerance), separators=(",", ":"))
        if len(texte.encode()) < TAILLE_MAX:
            break
    SORTIE.write_text(texte, "utf-8")
    print(f"tolérance {tolerance}, {len(texte.encode())} octets dans {SORTIE}")


if __name__ == "__main__":
    main()
