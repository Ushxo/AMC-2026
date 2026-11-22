"""Sortie du solveur -> ResultatOptimisation (contrat : contracts/optimisation.md, section 3)."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from optimisation.entrees import Donnees
from optimisation.modeles import Incident

FUSEAU = ZoneInfo("America/Toronto")
JOUR_DEMO = "2026-11-22"
RAISON_NON_SERVI = "temps du quart dépassé"

SOURCE_MATRICE = {"osrm": "osrm_cache", "mixte": "vol_oiseau", "vol_oiseau": "vol_oiseau"}


def iso(jour: date, secondes: int) -> str:
    """Heure locale du jour donné, à `secondes` après minuit, avec le fuseau."""
    dt = datetime.combine(jour, time(0), tzinfo=FUSEAU) + timedelta(seconds=int(secondes))
    return dt.isoformat(timespec="seconds")


def _position(p, lieu_id: str) -> dict[str, float]:
    lieu = next(x for x in p.lieux if x.id == lieu_id)
    return {"latitude": lieu.latitude, "longitude": lieu.longitude}


def equipes_contrat(d: Donnees) -> list[dict[str, Any]]:
    """Les équipes du calcul au format `Equipe` (sans membres réels)."""
    garages = {g["id"]: g for g in d.equipes_brutes["garages"]}
    brutes = {e["id"]: e for e in d.equipes_brutes["equipes"]}
    sortie = []
    for e in d.probleme.equipes:
        b = brutes.get(e.id) or next(iter(brutes.values()))
        g = garages[e.garage]
        sortie.append(
            {
                "id": e.id,
                "nom": e.nom,
                "membres": [],
                "vehicule": b.get("vehicule"),
                "garage": {"latitude": g["latitude"], "longitude": g["longitude"]},
                "debut_quart": b["debut_quart"],
                "fin_quart": b["fin_quart"],
                "active": True,
                "exemple_demo": True,
            }
            | ({"garage_nom": g["nom"]} if g.get("nom") else {})
        )
    return sortie


def vers_resultat(
    sortie: dict[str, Any],
    d: Donnees,
    jour: date,
    incidents: list[dict[str, Any]] | None = None,
    demande_id: str = "precalcule",
    precalcule: bool = True,
) -> dict[str, Any]:
    p = d.probleme
    graves = {a.id: a.gravite for a in p.arrets}
    tournees = []
    for t in sortie["tournees"]:
        equipe = next(e for e in p.equipes if e.id == t["equipe_id"])
        arrets = [
            {
                "rang": a["ordre"],
                "cle_endroit": f"{d.prefixe_cle}{a['arret_id']}",
                "signalement_ids": d.signalement_ids.get(a["arret_id"], []),
                "position": _position(p, a["arret_id"]),
                "arrivee_prevue": iso(jour, a["arrivee_s"]),
                "depart_prevu": iso(jour, a["depart_s"]),
            }
            for a in t["arrets"]
        ]
        tournees.append(
            {
                "equipe_id": t["equipe_id"],
                "equipe_nom": t["equipe_nom"],
                "distance_m": t["distance_m"],
                "duree_s": t["duree_s"],
                "debut_prevu": iso(jour, equipe.debut_s),
                "fin_prevue": iso(jour, t["retour_s"]),
                "geometrie": t.get("geometrie"),
                "arrets": arrets,
            }
        )
    g = sortie["gain"]
    resultat: dict[str, Any] = {
        "version": 1,
        "demande_id": demande_id,
        "statut": "terminee",
        "message": None,
        "calcule_le": datetime.now(UTC).astimezone(FUSEAU).isoformat(timespec="seconds"),
        "duree_calcul_ms": int(sortie["duree_calcul_s"] * 1000),
        "source_matrice": SOURCE_MATRICE.get(d.source_matrice, "osrm_cache"),
        "precalcule": precalcule,
        "incidents": incidents or [],
        "tournees": tournees,
        "non_servis": [
            {"cle_endroit": f"{d.prefixe_cle}{i}", "gravite": graves[i], "raison": RAISON_NON_SERVI}
            for i in sortie["non_servis"]
        ],
        "comparaison": {
            "ordre_arrivee": {
                "arrets_servis": g["ordre_arrivee"]["arrets_servis"],
                "distance_m": g["ordre_arrivee"]["distance_m"],
                "duree_s": g["ordre_arrivee"]["duree_s"],
                "depassement_quart_s": g["ordre_arrivee"]["depassement_quart_s"],
            },
            "optimise": {
                "arrets_servis": g["optimise"]["arrets_servis"],
                "distance_m": g["optimise"]["distance_m"],
                "duree_s": g["optimise"]["duree_s"],
            },
            "gain_distance_m": g["distance_gagnee_m"],
            "gain_duree_s": g["duree_gagnee_s"],
            "dans_le_quart": g["dans_le_quart"],
        },
    }
    return resultat


def incident_contrat(i: Incident, id_: str, type_: str = "rue_fermee") -> dict[str, Any]:
    return {
        "id": id_,
        "type": type_,
        "position": {"latitude": i.latitude, "longitude": i.longitude},
        "rayon_m": int(i.rayon_m),
        "simule": True,
    }
