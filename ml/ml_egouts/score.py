"""Transforme les probabilités du modèle en réponse pour l'app.

Pas de PyTorch ici : ce module sert aussi au serveur.

score_gravite (0-100) = moyenne des gravités pondérée par les probabilités,
en ne gardant que les classes de gravité :
    faible = 0, moyenne = 50, elevee = 100
Ex. P(moyenne) = 0,6 et P(elevee) = 0,4 → score 70.
L'équipe choisit ensuite ses seuils de difficulté sur ce score, sans réentraîner.
"""

from collections.abc import Sequence

POIDS_GRAVITE = {"faible": 0, "moyenne": 50, "elevee": 100}


def resultat(classes: Sequence[str], probabilites: Sequence[float]) -> dict:
    probas = dict(zip(classes, (float(p) for p in probabilites)))
    p_gravite = sum(probas[c] for c in POIDS_GRAVITE)
    score = (
        sum(POIDS_GRAVITE[c] * probas[c] for c in POIDS_GRAVITE) / p_gravite
        if p_gravite > 0 else 0.0
    )
    classe = max(probas, key=probas.get)
    valide = classe != "invalide"
    return {
        "valide": valide,
        "probabilite_valide": round(100 * (1 - probas["invalide"])),
        "score_gravite": round(score) if valide else None,
        "gravite": max(POIDS_GRAVITE, key=probas.get) if valide else None,
        "probabilites": {c: round(100 * p) for c, p in probas.items()},
    }
