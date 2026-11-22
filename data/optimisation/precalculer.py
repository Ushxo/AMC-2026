"""Calcule les résultats de démo au format ResultatOptimisation :

- data/out/tournees-demo.json : sans incident ;
- data/out/tournees-demo-incident.json : avec l'incident de démo (rue fermée sur le trajet d'une tournée).

Usage : uv run python -m optimisation.precalculer [--equipes N] [--limite S] [--seuil N] [--date AAAA-MM-JJ] [--sans-osrm]
"""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from datetime import date
from pathlib import Path
from typing import Any

from optimisation.adaptateur import JOUR_DEMO, equipes_contrat, incident_contrat, vers_resultat
from optimisation.entrees import OUT, Donnees, charger_donnees
from optimisation.geometrie import ajouter_geometries
from optimisation.modeles import Incident
from optimisation.solveur import resoudre

SORTIE = OUT / "tournees-demo.json"
SORTIE_INCIDENT = OUT / "tournees-demo-incident.json"
SORTIE_BRUT = (
    OUT / "tournees-brut.json"
)  # sortie du solveur avant l'adaptateur (non copiée dans l'app)
PENALITE_RUE_FERMEE_S = 1800  # valeur de travail du contrat
RAYON_INCIDENT_M = 100
ID_INCIDENT_DEMO = "incident-demo"


def _sequences(sortie: dict[str, Any]) -> dict[str, list[str]]:
    return {t["equipe_id"]: [a["arret_id"] for a in t["arrets"]] for t in sortie["tournees"]}


def candidats_incident(d: Donnees, sortie: dict[str, Any], combien: int = 6) -> list[Incident]:
    """Milieux des plus longs trajets de la tournée la plus chargée : un incident y gêne vraiment l'équipe."""
    position = {l.id: l for l in d.probleme.lieux}
    index = {l.id: i for i, l in enumerate(d.probleme.lieux)}
    tournee = max(sortie["tournees"], key=lambda t: len(t["arrets"]))
    legs = []
    for a, b in zip(tournee["lieux"], tournee["lieux"][1:], strict=False):
        legs.append((d.probleme.distance_m[index[a]][index[b]], a, b))
    legs.sort(reverse=True)
    out = []
    for _, a, b in legs[:combien]:
        la, lb = position[a], position[b]
        out.append(
            Incident(
                latitude=(la.latitude + lb.latitude) / 2,
                longitude=(la.longitude + lb.longitude) / 2,
                rayon_m=RAYON_INCIDENT_M,
                penalite_s=PENALITE_RUE_FERMEE_S,
            )
        )
    return out


def calculer(
    d: Donnees,
    jour: date,
    utiliser_osrm: bool,
    incident: Incident | None = None,
    initiales: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    p = replace(d.probleme, incidents=[incident] if incident else [], tournees_initiales=initiales)
    sortie = resoudre(p)
    ajouter_geometries(sortie, p, utiliser_osrm)
    incidents = [incident_contrat(incident, ID_INCIDENT_DEMO)] if incident else []
    resultat = vers_resultat(sortie, d, jour, incidents)
    resultat["equipes"] = equipes_contrat(d)
    resultat["hypotheses_demo"] = {
        "intervention_s": p.parametres.intervention_s,
        "quart": "07:00 à 14:00",
        "seuil_apparition": 1,
        "equipes": len(p.equipes),
        "note": "Garages, équipes, durée d'intervention, quart et incident sont des hypothèses de démo.",
    }
    resultat["_sequences"] = _sequences(sortie)
    resultat["_brut"] = sortie
    return resultat


def precalculer(
    dossier: Path = OUT,
    nombre_equipes: int | None = None,
    seuil: int = 1,
    limite_s: float = 8.0,
    utiliser_osrm: bool = True,
    jour: date | None = None,
    ecrire_brut: Path | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Rend (résultat sans incident, résultat avec l'incident de démo)."""
    jour = jour or date.fromisoformat(JOUR_DEMO)
    d = charger_donnees(dossier, nombre_equipes, seuil, limite_s)
    sans = calculer(d, jour, utiliser_osrm)
    avec = None
    meilleur = None
    for incident in candidats_incident(d, _pseudo_sortie(sans, d)):
        essai = calculer(d, jour, utiliser_osrm, incident, sans["_sequences"])
        meilleur = meilleur or essai
        if essai["_sequences"] != sans["_sequences"] or len(essai["non_servis"]) != len(
            sans["non_servis"]
        ):
            avec = essai
            break
    avec = avec or meilleur
    if ecrire_brut is not None:
        ecrire_brut.write_text(json.dumps(sans["_brut"], ensure_ascii=False), encoding="utf-8")
    for r in (sans, avec):
        r.pop("_sequences", None)
        r.pop("_brut", None)
    return sans, avec


def _pseudo_sortie(resultat: dict[str, Any], d: Donnees) -> dict[str, Any]:
    """Reconstruit, depuis un résultat au format du contrat, ce qu'il faut pour choisir l'incident."""
    garages = {e.id: e.garage for e in d.probleme.equipes}
    tournees = []
    for t in resultat["tournees"]:
        arrets = [a["cle_endroit"].removeprefix("grille:") for a in t["arrets"]]
        g = garages[t["equipe_id"]]
        tournees.append({"arrets": arrets, "lieux": [g, *arrets, g]})
    return {"tournees": tournees}


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--equipes", type=int, default=None)
    a.add_argument("--limite", type=float, default=8.0)
    a.add_argument("--seuil", type=int, default=1)
    a.add_argument("--date", default=JOUR_DEMO)
    a.add_argument("--sans-osrm", action="store_true")
    args = a.parse_args()
    sans, avec = precalculer(
        OUT,
        args.equipes,
        args.seuil,
        args.limite,
        not args.sans_osrm,
        date.fromisoformat(args.date),
        SORTIE_BRUT,
    )
    for chemin, r in ((SORTIE, sans), (SORTIE_INCIDENT, avec)):
        chemin.write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
        c = r["comparaison"]
        print(
            f"Écrit : {chemin.name} ; non servis : {len(r['non_servis'])} ; "
            f"gain : {c['gain_distance_m']} m, {c['gain_duree_s']} s"
        )


if __name__ == "__main__":
    main()
