"""Construit le problème depuis les fichiers de data/out/ (matrice, pénalités, équipes, signalements)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from optimisation.endroits import endroit_apparait
from optimisation.modeles import Arret, Equipe, Lieu, Parametres, Probleme

OUT = Path(__file__).resolve().parent.parent / "out"
ORDRE_GRAVITE = {"faible": 0, "moyenne": 1, "elevee": 2}
ETATS_OUVERTS = ("nouveau", "pris_en_charge")


def _lire(chemin: Path) -> Any:
    return json.loads(chemin.read_text(encoding="utf-8"))


def heure_en_secondes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 3600 + int(m) * 60


def arrets_depuis_signalements(
    signalements: list[dict[str, Any]], seuil: int = 1, ids_connus: set[str] | None = None
) -> list[Arret]:
    """Un arrêt par endroit (grille) : gravité la plus haute choisie, nombre d'ouverts, rang d'arrivée."""
    groupes: dict[str, list[dict[str, Any]]] = {}
    for s in signalements:
        if s.get("grille_id") and s["etat"] in ETATS_OUVERTS:
            groupes.setdefault(s["grille_id"], []).append(s)
    plus_ancien = {g: min(x["cree_le"] for x in liste) for g, liste in groupes.items()}
    rang = {g: i for i, g in enumerate(sorted(plus_ancien, key=lambda k: (plus_ancien[k], k)))}
    arrets = []
    for g, liste in groupes.items():
        if not endroit_apparait(liste, seuil) or (ids_connus is not None and g not in ids_connus):
            continue
        gravite = max((x["gravite"] for x in liste), key=lambda v: ORDRE_GRAVITE[v])
        arrets.append(Arret(id=g, gravite=gravite, nombre=len(liste), ordre_arrivee=rang[g]))
    return sorted(arrets, key=lambda a: a.ordre_arrivee)


def construire_equipes(donnees: dict[str, Any], nombre: int | None = None) -> list[Equipe]:
    """Les équipes du fichier ; au-delà, des copies sur les garages en alternance."""
    base = donnees["equipes"]
    garages = [g["id"] for g in donnees["garages"]]
    if nombre is not None and nombre < 1:
        raise ValueError("Il faut au moins une équipe.")
    total = len(base) if nombre is None else nombre
    equipes = []
    for i in range(total):
        if i < len(base):
            e = base[i]
        else:
            e = {
                **base[-1],
                "id": f"equipe-{i + 1}",
                "nom": f"Équipe {i + 1}",
                "garage_id": garages[i % len(garages)],
            }
        equipes.append(
            Equipe(
                id=e["id"],
                nom=e["nom"],
                garage=e["garage_id"],
                debut_s=heure_en_secondes(e["debut_quart"]),
                fin_s=heure_en_secondes(e["fin_quart"]),
            )
        )
    return equipes


@dataclass(frozen=True)
class Donnees:
    """Le problème et ce qu'il faut pour écrire le résultat au format du contrat."""

    probleme: Probleme
    signalement_ids: dict[str, list[str]]  # grille_id -> signalements ouverts de l'endroit
    source_matrice: str
    equipes_brutes: dict[str, Any]
    prefixe_cle: str = (
        "grille:"  # vide quand les identifiants d'arrêts sont déjà des clés d'endroit
    )


def charger_donnees(
    dossier: Path = OUT,
    nombre_equipes: int | None = None,
    seuil: int = 1,
    limite_s: float = 8.0,
    signalements: list[dict[str, Any]] | None = None,
) -> Donnees:
    matrice = _lire(dossier / "matrice.json")
    penalites = _lire(dossier / "penalites.json")
    donnees_equipes = _lire(dossier / "equipes-demo.json")
    if signalements is None:
        signalements = _lire(dossier / "signalements-demo.json")
    ids = [p["id"] for p in matrice["points"]]
    if penalites["points"] != ids:
        raise ValueError("Les pénalités et la matrice n'ont pas les mêmes points.")
    arrets = arrets_depuis_signalements(signalements, seuil, set(ids))
    # Un arrêt près d'un chantier prend plus de temps (pénalité de démo de Data, en secondes).
    extra = penalites.get("penalite_arret_s", {})
    intervention = int(donnees_equipes["duree_intervention_min"]) * 60
    arrets = [
        Arret(a.id, a.gravite, a.nombre, a.ordre_arrivee, intervention + int(extra.get(a.id, 0)))
        for a in arrets
    ]
    retenus = {a.id for a in arrets}
    par_grille: dict[str, list[str]] = {}
    for s in signalements:
        if s.get("grille_id") in retenus and s["etat"] in ETATS_OUVERTS:
            par_grille.setdefault(s["grille_id"], []).append(s["id"])
    probleme = Probleme(
        lieux=[Lieu(p["id"], p["latitude"], p["longitude"]) for p in matrice["points"]],
        temps_s=matrice["durees_s"],
        distance_m=matrice["distances_m"],
        penalites_s=penalites["penalites_s"],
        arrets=arrets,
        equipes=construire_equipes(donnees_equipes, nombre_equipes),
        parametres=Parametres(intervention_s=intervention, limite_s=limite_s),
    )
    return Donnees(probleme, par_grille, matrice.get("source", "osrm"), donnees_equipes)


def charger_probleme(
    dossier: Path = OUT,
    nombre_equipes: int | None = None,
    seuil: int = 1,
    limite_s: float = 8.0,
    signalements: list[dict[str, Any]] | None = None,
) -> Probleme:
    return charger_donnees(dossier, nombre_equipes, seuil, limite_s, signalements).probleme
