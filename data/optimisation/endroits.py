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
        if len(liste) < seuil:
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
