"""Réseau utilisé : MobileNetV3-Small pré-entraîné sur ImageNet.

Petit (2,5 M paramètres, ~10 Mo), rapide sur téléphone ou serveur, et
efficace en apprentissage par transfert avec peu de photos.
"""

import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

from ml_egouts import CLASSES


def construire_modele(pre_entraine: bool = True) -> nn.Module:
    poids = MobileNet_V3_Small_Weights.DEFAULT if pre_entraine else None
    modele = mobilenet_v3_small(weights=poids)
    # Dernière couche : 1000 classes ImageNet → nos 4 classes.
    entree = modele.classifier[3].in_features
    modele.classifier[3] = nn.Linear(entree, len(CLASSES))
    return modele


def geler_extracteur(modele: nn.Module, gele: bool) -> None:
    """Gèle (ou dégèle) la partie pré-entraînée pour n'entraîner que la tête."""
    for parametre in modele.features.parameters():
        parametre.requires_grad = not gele


def charger_modele(chemin: str, appareil: str = "cpu") -> nn.Module:
    modele = construire_modele(pre_entraine=False)
    etat = torch.load(chemin, map_location=appareil, weights_only=True)
    modele.load_state_dict(etat)
    return modele.to(appareil).eval()
