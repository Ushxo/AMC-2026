"""Juge une photo d'égout avec le modèle entraîné.

    uv run python -m ml_egouts.predire chemin/vers/photo.jpg

Affiche par exemple (pourcentages) :
    {"valide": true, "probabilite_valide": 98, "score_gravite": 87, "gravite": "elevee",
     "probabilites": {"invalide": 2, "faible": 3, "moyenne": 20, "elevee": 75}}
"""

import argparse
import json
from pathlib import Path

import torch
from torch import nn

from ml_egouts import CLASSES
from ml_egouts.donnees import ouvrir_image, transformation_evaluation
from ml_egouts.modele import charger_modele
from ml_egouts.score import resultat


def probabilites(modele: nn.Module, chemin_image: Path | str) -> list[float]:
    appareil = next(modele.parameters()).device
    tenseur = transformation_evaluation(ouvrir_image(chemin_image)).unsqueeze(0).to(appareil)
    with torch.no_grad():
        return torch.softmax(modele(tenseur), dim=1)[0].tolist()


def predire(modele: nn.Module, chemin_image: Path | str) -> dict:
    return resultat(CLASSES, probabilites(modele, chemin_image))


def main() -> None:
    racine = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Juge une ou plusieurs photos d'égout.")
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--modele", type=Path, default=racine / "modeles" / "modele.pt")
    args = parser.parse_args()

    modele = charger_modele(str(args.modele))
    for image in args.images:
        print(image.name, json.dumps(predire(modele, image), ensure_ascii=False))


if __name__ == "__main__":
    main()
