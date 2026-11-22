"""Index d'adresses dédoublonné depuis les puisards, vers data/out/adresses.json."""

import json
from pathlib import Path

SORTIE = Path(__file__).resolve().parent.parent / "out" / "adresses.json"
GRILLES = SORTIE.parent / "grilles.geojson"


def construire(grilles: dict) -> list[dict]:
    """Une entrée par adresse, avec la position du premier puisard qui la porte."""
    index: dict[str, dict] = {}
    for f in grilles["features"]:
        libelle = f["properties"].get("adresse")
        if not libelle or libelle in index:
            continue
        lng, lat = f["geometry"]["coordinates"]
        index[libelle] = {"libelle": libelle, "latitude": lat, "longitude": lng}
    return sorted(index.values(), key=lambda a: a["libelle"])


def main() -> None:
    grilles = json.loads(GRILLES.read_text("utf-8"))
    adresses = construire(grilles)
    SORTIE.write_text(json.dumps(adresses, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{len(adresses)} adresses écrites dans {SORTIE}")


if __name__ == "__main__":
    main()
