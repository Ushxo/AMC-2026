"""Regards d'égout du quartier de démo vers data/out/regards.json (couche grise de la carte).

Source : jeu « Regards d'égouts » du portail de données ouvertes de Montréal (CSV). Le fichier
n'est pas dans le dépôt. Son chemin se donne en argument, par la variable REGARDS_CSV, ou par
défaut à la racine de l'espace de travail.

    uv run python -m scripts.regards [chemin.csv] [--avec-chambres]
"""

import argparse
import csv
import json
import os
from collections.abc import Iterable
from pathlib import Path

from scripts import quartier

CHEMIN_PAR_DEFAUT = Path("/Users/usho/Developer/hackathon-2026/ego_regard_p.csv")
SORTIE = Path(__file__).resolve().parent.parent / "out" / "regards.json"

# Types qui se voient dans la rue comme un regard. Les chambres d'accès sont à part : ce sont
# des couvercles de chambres de vannes ou d'égout, écartés sauf demande.
TYPES = {"REGARD", "REGARD-PUISARD"}
TYPES_CHAMBRES = TYPES | {"ACCES CHAMBRE"}


def lire_lignes(chemin: Path) -> Iterable[dict]:
    if not chemin.exists():
        raise SystemExit(
            f"Fichier des regards introuvable : {chemin}. "
            "Donnez son chemin en argument ou dans la variable REGARDS_CSV."
        )
    with chemin.open(encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def construire(lignes: Iterable[dict], types: set[str] = TYPES) -> tuple[list[dict], dict]:
    """Regards existants et visibles du quartier. Rend la liste et le décompte par étape."""
    compte = {"lignes": 0, "quartier": 0, "existants": 0, "retenus": 0}
    vus: set[str] = set()
    regards = []
    for ligne in lignes:
        compte["lignes"] += 1
        try:
            lat, lng = float(ligne["LATITUDE"]), float(ligne["LONGITUDE"])
        except (TypeError, ValueError, KeyError):
            continue
        if not quartier.dans_quartier(lat, lng):
            continue
        compte["quartier"] += 1
        if (ligne.get("STATUT_ACTIF") or "").strip() != "EXISTANT":
            continue
        compte["existants"] += 1
        identifiant = (ligne.get("ID_REGARD") or "").strip()
        if (
            not identifiant
            or identifiant in vus
            or (ligne.get("VISIBLE") or "").strip() != "OUI"
            or (ligne.get("TYPE_REGARD_EG") or "").strip() not in types
        ):
            continue
        vus.add(identifiant)
        regards.append(
            {
                "id": identifiant,
                "latitude": round(lat, 6),
                "longitude": round(lng, 6),
                "adresse": (ligne.get("ADRESSE") or "").strip() or None,
            }
        )
    compte["retenus"] = len(regards)
    regards.sort(key=lambda r: (len(r["id"]), r["id"]))
    return regards, compte


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", nargs="?", help="chemin du CSV des regards")
    parser.add_argument("--avec-chambres", action="store_true", help="garder les accès chambre")
    args = parser.parse_args()
    chemin = Path(args.csv or os.environ.get("REGARDS_CSV") or CHEMIN_PAR_DEFAUT)
    regards, compte = construire(
        lire_lignes(chemin), TYPES_CHAMBRES if args.avec_chambres else TYPES
    )
    SORTIE.write_text(json.dumps(regards, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{compte} -> {SORTIE} ({SORTIE.stat().st_size} octets)")


if __name__ == "__main__":
    main()
