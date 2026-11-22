"""Recalcul pour une partie des équipes.

`publier_tournees` efface toutes les tournées avant d'écrire celles de la demande, et l'app lit les
tournées de la dernière demande terminée. Quand une demande ne porte que sur certaines équipes, le
service relit le plan en place et republie telles quelles les tournées des autres équipes. Les arrêts
déjà faits de l'équipe recalculée restent en tête du plan avec leur état ; seuls les arrêts restants
sont réordonnés.
"""

from __future__ import annotations

from typing import Any


def _arrets_depuis_lignes(ligne: dict[str, Any]) -> list[dict[str, Any]]:
    """Arrêts d'une tournée lue dans la base, au format de sortie du service, dans l'ordre des rangs."""
    return [
        {
            "rang": a["rang"],
            "cle_endroit": a["cle_endroit"],
            "signalement_ids": list(a.get("signalement_ids") or []),
            "position": {"latitude": a["latitude"], "longitude": a["longitude"]},
            "arrivee_prevue": a["arrivee_prevue"],
            "depart_prevu": a["depart_prevu"],
            "fait": bool(a.get("fait")),
            "fait_le": a.get("fait_le"),
        }
        for a in sorted(ligne.get("arrets") or [], key=lambda a: a["rang"])
    ]


# Détails d'une tournée gardés dans la colonne `tournees.details` (migration 0006) : d'où elle part,
# où elle finit, et si elle vient d'un recalcul partiel.
DETAILS = (
    "depart",
    "depart_position",
    "fin",
    "fin_position",
    "fin_nom",
    "conservee",
    "recalculee",
    "faits_conserves",
)


def details_de(tournee: dict[str, Any]) -> dict[str, Any]:
    """Les détails d'une tournée de sortie (premier niveau), sans les valeurs absentes."""
    return {cle: tournee[cle] for cle in DETAILS if tournee.get(cle) is not None}


def tournee_conservee(ligne: dict[str, Any], nom: str | None) -> dict[str, Any]:
    """Une tournée du plan en place, republiée telle quelle (mêmes rangs, heures, tracé, état fait,
    et mêmes détails de départ et de fin quand la colonne `details` existe)."""
    anciens = ligne.get("details") or {}
    conservees = {cle: anciens[cle] for cle in DETAILS if cle != "conservee" and cle in anciens}
    return {
        **conservees,
        "equipe_id": ligne["equipe_id"],
        "equipe_nom": nom or ligne.get("equipe_nom") or "",
        "distance_m": ligne["distance_m"],
        "duree_s": ligne["duree_s"],
        "debut_prevu": ligne["debut_prevu"],
        "fin_prevue": ligne["fin_prevue"],
        "geometrie": ligne.get("geometrie"),
        "conservee": True,
        "arrets": _arrets_depuis_lignes(ligne),
    }


def cles_a_exclure(en_place: list[dict[str, Any]], equipes_recalculees: set[str]) -> set[str]:
    """Endroits à ne pas replanifier : ceux des autres équipes, et ceux déjà faits par les équipes recalculées."""
    cles: set[str] = set()
    for ligne in en_place:
        recalculee = ligne["equipe_id"] in equipes_recalculees
        for a in ligne.get("arrets") or []:
            if not recalculee or a.get("fait"):
                cles.add(a["cle_endroit"])
    return cles


def totaux(tournees: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "distance_m": sum(t["distance_m"] for t in tournees),
        "duree_s": sum(t["duree_s"] for t in tournees),
        "arrets_servis": sum(len(t["arrets"]) for t in tournees),
    }


def fusionner(
    resultat: dict[str, Any],
    en_place: list[dict[str, Any]],
    equipes_recalculees: set[str],
    noms: dict[str, str],
) -> dict[str, Any]:
    """Ajoute au résultat du recalcul les arrêts faits de chaque équipe recalculée et les tournées des
    autres équipes. Pour une équipe recalculée, `distance_m`, `duree_s` et `debut_prevu` décrivent la partie
    restante (depuis le départ) ; les arrêts faits gardent leurs heures d'origine."""
    ligne_par_equipe = {ligne["equipe_id"]: ligne for ligne in en_place}
    for t in resultat["tournees"]:
        ligne = ligne_par_equipe.get(t["equipe_id"])
        faits = [a for a in _arrets_depuis_lignes(ligne) if a["fait"]] if ligne else []
        for i, a in enumerate(faits, start=1):
            a["rang"] = i
        for a in t["arrets"]:
            a["rang"] += len(faits)
            a.setdefault("fait", False)
            a.setdefault("fait_le", None)
        t["arrets"] = faits + t["arrets"]
        t["recalculee"] = True
        t["faits_conserves"] = len(faits)
    # Une équipe demandée mais absente du calcul (quart terminé) garde aussi son plan en place.
    presentes = {t["equipe_id"] for t in resultat["tournees"]}
    conservees = [
        tournee_conservee(ligne, noms.get(ligne["equipe_id"]))
        for ligne in en_place
        if ligne["equipe_id"] not in presentes
    ]
    resultat["tournees"] = sorted(
        [*resultat["tournees"], *conservees],
        key=lambda t: (t.get("equipe_nom") or "", t["equipe_id"]),
    )
    resultat["portee"] = "partiel"
    resultat["comparaison"]["portee"] = "partiel"
    resultat["totaux"] = totaux(resultat["tournees"])
    return resultat
