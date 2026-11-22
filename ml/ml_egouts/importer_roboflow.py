"""Pré-range les datasets Roboflow (format COCO) de ml/donnees/brut/ dans images/<classe>/.

    uv run python -m ml_egouts.importer_roboflow

Chaque image prend la classe de ses étiquettes Roboflow selon CORRESPONDANCES.
Les images sans correspondance claire restent pour l'outil de tri manuel
(ml_egouts.trier) ; celles rangées ici sont notées dans brut/tri.json pour
ne pas être reproposées.
"""

import json
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from ml_egouts import CLASSES
from ml_egouts.donnees import EXTENSIONS

RACINE = Path(__file__).resolve().parent.parent / "donnees"

# dossier dans brut/ -> {étiquette Roboflow: notre classe}
CORRESPONDANCES = {
    # « drain » par traffic (CC BY 4.0) : grilles posées sur fond clair.
    # Vérifié sur une planche d'exemples : 0 = propre, 2 = quelques feuilles, 1 = pleine.
    "roboflow_drain": {"0": "faible", "2": "moyenne", "1": "elevee"},
    # « drain overflow » par Chaitanya Kharche (MIT) : regards et grilles de rue.
    "roboflow_overflow": {
        "closed manhole-not overflowing-": "faible",
        "open drainage-not overflowing-": "faible",
        "drainage overflow-repair-": "elevee",
        "open drainage-overflowing-": "elevee",
    },
}
# Dossiers de brut/ dont toutes les photos vont dans une seule classe
# (photos Wikimedia hors sujet : selfies, voitures, intérieurs, animaux...).
DOSSIERS_ENTIERS = {"hors_sujet": "invalide"}
# Plus grave en premier : une image avec plusieurs étiquettes prend la plus grave.
PRIORITE = ["elevee", "moyenne", "faible", "invalide"]


def classe_image(etiquettes: set[str], correspondance: dict[str, str]) -> str | None:
    classes = {correspondance[e] for e in etiquettes if e in correspondance}
    if not classes or any(e not in correspondance for e in etiquettes):
        return None  # sans étiquette, ou étiquette ambiguë : tri manuel
    return next(c for c in PRIORITE if c in classes)


def importer(racine: Path = RACINE) -> Counter:
    brut, images = racine / "brut", racine / "images"
    chemin_journal = brut / "tri.json"
    journal = json.loads(chemin_journal.read_text("utf-8")) if chemin_journal.exists() else {}
    bilan = Counter()

    for dossier, correspondance in CORRESPONDANCES.items():
        for fichier_coco in sorted((brut / dossier).glob("*/_annotations.coco.json")):
            coco = json.loads(fichier_coco.read_text("utf-8"))
            noms = {c["id"]: c["name"] for c in coco["categories"]}
            etiquettes = defaultdict(set)
            for annotation in coco["annotations"]:
                etiquettes[annotation["image_id"]].add(noms[annotation["category_id"]])

            for image in coco["images"]:
                source = fichier_coco.parent / image["file_name"]
                relatif = str(source.relative_to(brut))
                if relatif in journal or not source.exists():
                    continue
                classe = classe_image(etiquettes.get(image["id"], set()), correspondance)
                if classe is None:
                    bilan[f"{dossier} : à trier à la main"] += 1
                    continue
                assert classe in CLASSES
                (images / classe).mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, images / classe / "_".join(Path(relatif).parts))
                journal[relatif] = classe
                bilan[f"{dossier} : {classe}"] += 1

    for dossier, classe in DOSSIERS_ENTIERS.items():
        for source in sorted((brut / dossier).glob("*")):
            relatif = str(source.relative_to(brut))
            if relatif in journal or source.suffix.lower() not in EXTENSIONS:
                continue
            (images / classe).mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, images / classe / "_".join(Path(relatif).parts))
            journal[relatif] = classe
            bilan[f"{dossier} : {classe}"] += 1

    # Fusion avec le fichier actuel : l'outil de tri peut y avoir écrit entre-temps.
    actuel = json.loads(chemin_journal.read_text("utf-8")) if chemin_journal.exists() else {}
    chemin_journal.write_text(json.dumps({**journal, **actuel}, indent=1), "utf-8")
    return bilan


if __name__ == "__main__":
    for ligne, n in sorted(importer().items()):
        print(f"{n:4d}  {ligne}")
