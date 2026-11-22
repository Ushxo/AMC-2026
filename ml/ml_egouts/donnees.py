"""Chargement des photos d'entraînement.

Organisation attendue (un dossier par classe, n'importe quels noms de fichiers) :

    ml/donnees/images/
        invalide/   selfies, photos floues, objets sans rapport...
        faible/     grille un peu sale, quelques feuilles
        moyenne/    grille en partie bouchée, flaque autour
        elevee/     grille complètement bouchée, rue inondée, refoulement
"""

import random
from collections import Counter
from pathlib import Path

from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from ml_egouts import CLASSES

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
TAILLE = 224
# Normalisation des réseaux pré-entraînés sur ImageNet.
MOYENNE = (0.485, 0.456, 0.406)
ECART_TYPE = (0.229, 0.224, 0.225)

Exemple = tuple[Path, int]

transformation_entrainement = transforms.Compose([
    # scale bas : le modèle voit aussi des gros plans (déchet sur une grille).
    transforms.RandomResizedCrop(TAILLE, scale=(0.25, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize(MOYENNE, ECART_TYPE),
])

transformation_evaluation = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(TAILLE),
    transforms.ToTensor(),
    transforms.Normalize(MOYENNE, ECART_TYPE),
])


def lister_images(dossier: Path) -> list[Exemple]:
    """Toutes les images du dossier, avec l'indice de leur classe."""
    exemples = []
    for indice, classe in enumerate(CLASSES):
        sous_dossier = dossier / classe
        if not sous_dossier.is_dir():
            continue
        for fichier in sorted(sous_dossier.iterdir()):
            if fichier.suffix.lower() in EXTENSIONS:
                exemples.append((fichier, indice))
    return exemples


def separer(
    exemples: list[Exemple], part_validation: float = 0.2, graine: int = 42
) -> tuple[list[Exemple], list[Exemple]]:
    """Sépare entraînement / validation en gardant la même proportion de chaque classe."""
    hasard = random.Random(graine)
    entrainement, validation = [], []
    for indice in range(len(CLASSES)):
        de_la_classe = [e for e in exemples if e[1] == indice]
        hasard.shuffle(de_la_classe)
        n_val = round(len(de_la_classe) * part_validation)
        if len(de_la_classe) >= 2:
            n_val = max(1, n_val)
        validation += de_la_classe[:n_val]
        entrainement += de_la_classe[n_val:]
    return entrainement, validation


def compter(exemples: list[Exemple]) -> dict[str, int]:
    nombres = Counter(indice for _, indice in exemples)
    return {classe: nombres.get(i, 0) for i, classe in enumerate(CLASSES)}


def ouvrir_image(chemin: Path | str) -> Image.Image:
    with Image.open(chemin) as image:
        return image.convert("RGB")


class PhotosEgouts(Dataset):
    def __init__(self, exemples: list[Exemple], transformation):
        self.exemples = exemples
        self.transformation = transformation

    def __len__(self) -> int:
        return len(self.exemples)

    def __getitem__(self, i: int):
        chemin, indice = self.exemples[i]
        return self.transformation(ouvrir_image(chemin)), indice
