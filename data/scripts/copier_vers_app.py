"""Écrit data/out/meta.json puis copie data/out/ vers app/src/donnees/."""

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from shapely.geometry import Point, shape

from scripts import avis_eau, chantiers, grilles, quartier, zones_inondables

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "out"
DESTINATION = RACINE.parent / "app" / "src" / "donnees"

# Liste explicite des fichiers publics : un nouveau fichier de data/out/ n'entre jamais dans
# l'app par accident (matrice, pénalités et sortie brute du solveur restent côté données).
PUBLICS = (
    "adresses",
    "avis-eau",
    "avis-eau-troncons",
    "chantiers",
    "equipes-demo",
    "grilles",
    "meta",
    "regards",
    "signalements-demo",
    "tournees-demo",
    "tournees-demo-incident",
    "troncons",
    "zones-inondables",
)

SOURCES = [
    ("Puisards d'égouts", grilles.RESSOURCE, "grilles.geojson"),
    ("Avis et alertes (GeoJSON)", avis_eau.RESSOURCE_GEOJSON, "avis-eau.geojson"),
    ("Entraves et travaux en cours", chantiers.RESSOURCE, "chantiers.geojson"),
    ("Vulnérabilité aux crues 2022", zones_inondables.RESSOURCE, "zones-inondables.geojson"),
]


def _lignes(chemin: Path) -> int:
    if not chemin.exists():
        return 0
    donnees = json.loads(chemin.read_text("utf-8"))
    return len(donnees["features"] if isinstance(donnees, dict) else donnees)


def adresse_demo(avis: dict, adresses: list[dict]) -> dict | None:
    """Adresse de l'index située dans le polygone du plus récent avis d'ébullition du quartier."""
    ouverts = [
        f
        for f in avis["features"]
        if f["properties"].get("type") == "ebullition"
        and f["geometry"]
        and f["geometry"]["type"] in ("Polygon", "MultiPolygon")
    ]
    ouverts.sort(key=lambda f: f["properties"]["debut"], reverse=True)
    for f in ouverts:
        zone = shape(f["geometry"])
        dedans = [a for a in adresses if zone.contains(Point(a["longitude"], a["latitude"]))]
        if not dedans:
            continue
        titre = f["properties"]["titre"].lower()
        dedans.sort(
            key=lambda a: (a["libelle"].split(" ", 1)[-1].lower() not in titre, a["libelle"])
        )
        a = dedans[0]
        return {
            "libelle": a["libelle"],
            "latitude": a["latitude"],
            "longitude": a["longitude"],
        }
    return None


def construire_meta(sortie: Path = SORTIE) -> dict:
    avis = json.loads((sortie / "avis-eau.geojson").read_text("utf-8"))
    places = {"geometrie_source": 0, "adresse": 0, "aucun": 0}
    for f in avis["features"]:
        places[f["properties"]["placement"]] += 1
    chemin = sortie / "adresses.json"
    adresses = json.loads(chemin.read_text("utf-8")) if chemin.exists() else []
    return {
        "copieDu": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "quartier": quartier.NOM,
        "region": quartier.REGION,
        "sources": [
            {"nom": nom, "identifiant": ident, "lignes": _lignes(sortie / fichier)}
            for nom, ident, fichier in SOURCES
        ],
        "avisPlaces": places,
        "adresseDemo": adresse_demo(avis, adresses),
    }


def copier(sortie: Path = SORTIE, destination: Path = DESTINATION) -> list[str]:
    """Copie les fichiers ; les couches .geojson deviennent .json (Metro ne lit pas .geojson)."""
    meta = construire_meta(sortie)
    (sortie / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    destination.mkdir(parents=True, exist_ok=True)
    for ancien in destination.glob("*.geojson"):
        ancien.unlink()
    copies = []
    for nom in PUBLICS:
        for extension in (".json", ".geojson"):
            fichier = sortie / (nom + extension)
            if fichier.exists():
                shutil.copy2(fichier, destination / (nom + ".json"))
                copies.append(nom + ".json")
                break
    return copies


def main() -> None:
    print("Copiés :", ", ".join(copier()))


if __name__ == "__main__":
    main()
