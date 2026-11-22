"""Entrées du solveur de tournées. Tout est en secondes, en mètres et en degrés, et se lit depuis du JSON."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

GRAVITES = ("faible", "moyenne", "elevee")

# Hypothèse de démo : aucune source ouverte pour la durée d'une intervention.
# À annoncer comme telle partout où elle est affichée.
HYPOTHESE_INTERVENTION_S = 600

# Poids du modèle (pas des faits) : un arrêt grave non servi coûte toujours bien plus
# qu'un arrêt moins grave, quelle que soit la distance.
PENALITE_NON_VISITE_DEFAUT = {"faible": 10_000, "moyenne": 100_000, "elevee": 1_000_000}


@dataclass(frozen=True)
class Lieu:
    id: str
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True)
class Arret:
    """Un endroit à visiter. `id` est l'identifiant d'un lieu (par exemple la grille)."""

    id: str
    gravite: str
    nombre: int = 1
    ordre_arrivee: int = 0  # rang du plus ancien signalement (0 = le plus ancien)
    intervention_s: int | None = None  # sinon le paramètre général


@dataclass(frozen=True)
class Equipe:
    id: str
    nom: str
    garage: str  # identifiant d'un lieu
    fin_s: int  # retour au garage au plus tard, en secondes depuis le début de la journée
    debut_s: int = 0


@dataclass(frozen=True)
class Incident:
    latitude: float
    longitude: float
    rayon_m: float
    penalite_s: int  # temps ajouté à tout trajet dont la ligne droite passe dans le rayon


@dataclass(frozen=True)
class Parametres:
    intervention_s: int = HYPOTHESE_INTERVENTION_S
    limite_s: float = 8.0  # temps de calcul maximal (5 à 10 s)
    penalite_non_visite: dict[str, int] = field(
        default_factory=lambda: dict(PENALITE_NON_VISITE_DEFAUT)
    )
    equilibrage: int = 0  # poids de l'écart de durée entre équipes (0 = ignoré)


@dataclass(frozen=True)
class Probleme:
    lieux: list[Lieu]
    temps_s: list[list[int]]
    distance_m: list[list[int]]
    arrets: list[Arret]
    equipes: list[Equipe]
    penalites_s: list[list[int]] | None = None  # chantiers : même taille que temps_s
    incidents: list[Incident] = field(default_factory=list)
    parametres: Parametres = field(default_factory=Parametres)
    tournees_initiales: dict[str, list[str]] | None = (
        None  # equipe_id -> ids d'arrêts (réoptimisation)
    )

    @staticmethod
    def depuis_dict(d: dict[str, Any]) -> Probleme:
        p = d.get("parametres", {})
        defauts = Parametres()
        return Probleme(
            lieux=[Lieu(**x) for x in d["lieux"]],
            temps_s=d["temps_s"],
            distance_m=d["distance_m"],
            arrets=[Arret(**x) for x in d["arrets"]],
            equipes=[Equipe(**x) for x in d["equipes"]],
            penalites_s=d.get("penalites_s"),
            incidents=[Incident(**x) for x in d.get("incidents", [])],
            parametres=Parametres(
                intervention_s=p.get("intervention_s", defauts.intervention_s),
                limite_s=p.get("limite_s", defauts.limite_s),
                penalite_non_visite={
                    **defauts.penalite_non_visite,
                    **p.get("penalite_non_visite", {}),
                },
                equilibrage=p.get("equilibrage", defauts.equilibrage),
            ),
            tournees_initiales=d.get("tournees_initiales"),
        )
