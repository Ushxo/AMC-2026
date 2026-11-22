"""Classifieur de photos d'égouts pour les signalements citoyens.

Une seule prédiction par photo, parmi 4 classes :
  - invalide : la photo ne montre pas un égout ou une grille exploitable
  - faible, moyenne, elevee : gravité du problème (mêmes valeurs que
    signalements.gravite dans Supabase)
"""

CLASSES = ("invalide", "faible", "moyenne", "elevee")
GRAVITES = CLASSES[1:]
