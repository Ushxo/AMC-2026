"""Endroits signalés (même règle que l'app : lib/gravite.ts) à partir des signalements ouverts."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

PAS_CASE = 0.0005
SEUIL_MOYENNE = 20
SEUIL_ELEVEE = 50
ORDRE = {"faible": 0, "moyenne": 1, "elevee": 2}
OUVERTS = ("nouveau", "pris_en_charge")
# Seuil d'apparition d'un endroit (même règle que app/src/lib/config.ts) : sans photo vérifiée, il faut
# au moins SEUIL_SANS_PHOTO signalements ouverts ; avec au moins un signalement à photo vérifiée, un seul suffit.
SEUIL_SANS_PHOTO = 3
SEUIL_AVEC_PHOTO = 1


def photo_verifiee(s: dict[str, Any]) -> bool:
    """Champ absent ou nul = vérifié (ancien signalement, données de démo, base sans la colonne)."""
    return s.get("photo_verifiee") is not False


def endroit_apparait(ouverts: list[dict[str, Any]], seuil: int = 1) -> bool:
    """Un endroit entre dans le calcul si, parmi ses signalements ouverts, au moins `SEUIL_AVEC_PHOTO` a une
    photo vérifiée ou au moins `SEUIL_SANS_PHOTO` au total ; `seuil` est un plancher supplémentaire."""
    if len(ouverts) < seuil:
        return False
    avec_photo = sum(1 for x in ouverts if photo_verifiee(x))
    return avec_photo >= SEUIL_AVEC_PHOTO or len(ouverts) >= SEUIL_SANS_PHOTO


def _arrondir(v: float) -> str:
    # Même arrondi que Math.round de l'app (la moitié vers le haut).
    return f"{math.floor(v / PAS_CASE + 0.5) * PAS_CASE:.4f}"


def cle_endroit(s: dict[str, Any]) -> str:
    if s.get("grille_id"):
        return f"grille:{s['grille_id']}"
    return f"case:{_arrondir(s['latitude'])}:{_arrondir(s['longitude'])}"


def gravite_par_nombre(n: int) -> str:
    return "elevee" if n >= SEUIL_ELEVEE else "moyenne" if n >= SEUIL_MOYENNE else "faible"


@dataclass(frozen=True)
class Endroit:
    cle: str
    latitude: float
    longitude: float
    gravite: str  # gravité affichée : la plus haute entre la gravité choisie et celle du nombre
    signalement_ids: list[str]
    premier_le: str


def regrouper_ouverts(signalements: list[dict[str, Any]], seuil: int = 1) -> list[Endroit]:
    groupes: dict[str, list[dict[str, Any]]] = {}
    for s in signalements:
        if s["etat"] in OUVERTS:
            groupes.setdefault(cle_endroit(s), []).append(s)
    endroits = []
    for cle, liste in groupes.items():
        if not endroit_apparait(liste, seuil):
            continue
        choisie = max((x["gravite"] for x in liste), key=lambda g: ORDRE[g])
        par_nombre = gravite_par_nombre(len(liste))
        affichee = choisie if ORDRE[choisie] >= ORDRE[par_nombre] else par_nombre
        endroits.append(
            Endroit(
                cle=cle,
                latitude=sum(x["latitude"] for x in liste) / len(liste),
                longitude=sum(x["longitude"] for x in liste) / len(liste),
                gravite=affichee,
                signalement_ids=[x["id"] for x in liste],
                premier_le=min(x["cree_le"] for x in liste),
            )
        )
    return sorted(endroits, key=lambda e: (e.premier_le, e.cle))
