"""Puisards du quartier de démo vers data/out/grilles.geojson."""

import json
from pathlib import Path

from scripts import quartier
from scripts.sql import requete_sql

RESSOURCE = "39316ed3-0060-4975-ae82-482919dcc7c3"
SORTIE = Path(__file__).resolve().parent.parent / "out" / "grilles.geojson"


def requete() -> str:
    return (
        'SELECT "ID_PUISARD","ADRESSE","PROVENANCE_DONNEE","LATITUDE","LONGITUDE" '
        f'FROM "{RESSOURCE}" WHERE "STATUT_ACTIF"=\'EXISTANT\' '
        f'AND "LATITUDE"::numeric BETWEEN {quartier.LAT_MIN} AND {quartier.LAT_MAX} '
        f'AND "LONGITUDE"::numeric BETWEEN {quartier.LNG_MIN} AND {quartier.LNG_MAX} '
        'ORDER BY "ID_PUISARD"::numeric LIMIT 32000'
    )


def _texte(valeur) -> str | None:
    valeur = (valeur or "").strip()
    return valeur or None


def construire(lignes: list[dict]) -> dict:
    """Transforme les lignes du portail en FeatureCollection de Point."""
    vus: set[str] = set()
    features = []
    for ligne in lignes:
        identifiant = str(ligne["ID_PUISARD"]).strip()
        if identifiant in vus:
            continue
        try:
            lat = float(ligne["LATITUDE"])
            lng = float(ligne["LONGITUDE"])
        except (TypeError, ValueError):
            continue
        if not quartier.dans_quartier(lat, lng):
            continue
        vus.add(identifiant)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                "properties": {
                    "id": identifiant,
                    "origine": "officiel",
                    "gravite": "faible",
                    "adresse": _texte(ligne.get("ADRESSE")),
                    "provenance": _texte(ligne.get("PROVENANCE_DONNEE")),
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    donnees = construire(requete_sql(requete()))
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{len(donnees['features'])} grilles écrites dans {SORTIE}")


if __name__ == "__main__":
    main()
