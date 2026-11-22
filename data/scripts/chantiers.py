"""Permis de travaux actifs du quartier de démo vers data/out/chantiers.geojson."""

import json
from datetime import date
from pathlib import Path

from scripts import quartier
from scripts.sql import requete_sql

RESSOURCE = "cc41b532-f12d-40fb-9f55-eb58c9a2b12b"
SORTIE = Path(__file__).resolve().parent.parent / "out" / "chantiers.geojson"


def requete() -> str:
    return (
        'SELECT "permit_permit_id","organizationname","duration_start_date","duration_end_date",'
        f'"latitude","longitude" FROM "{RESSOURCE}" '
        f'WHERE "latitude"::numeric BETWEEN {quartier.LAT_MIN} AND {quartier.LAT_MAX} '
        f'AND "longitude"::numeric BETWEEN {quartier.LNG_MIN} AND {quartier.LNG_MAX} '
        "LIMIT 32000"
    )


def _date(valeur) -> str | None:
    return (valeur or "")[:10] or None


def construire(lignes: list[dict], aujourdhui: date | None = None) -> dict:
    """Garde les permis dont la période couvre la date de copie. Un Point par permis."""
    jour = (aujourdhui or date.today()).isoformat()
    vus: set[str] = set()
    features = []
    for ligne in lignes:
        identifiant = (ligne.get("permit_permit_id") or "").strip()
        debut, fin = _date(ligne.get("duration_start_date")), _date(ligne.get("duration_end_date"))
        if not identifiant or identifiant in vus or not debut or debut > jour:
            continue
        if fin and fin < jour:
            continue
        try:
            lat, lng = float(ligne["latitude"]), float(ligne["longitude"])
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
                    "entreprise": (ligne.get("organizationname") or "").strip() or None,
                    "debut": debut,
                    "fin": fin,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    donnees = construire(requete_sql(requete()))
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{len(donnees['features'])} chantiers écrits dans {SORTIE}")


if __name__ == "__main__":
    main()
