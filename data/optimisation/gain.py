"""Comparaison avec l'ordre d'arrivée des signalements (même matrice, mêmes équipes).

Référence « à travail égal » : l'ordre d'arrivée sert les mêmes arrêts que le plan optimisé, sans limite
de quart ; son dépassement du quart est donné à part. Mesure séparée : les arrêts servis dans le quart
par chaque plan. L'ordre d'arrivée est notre règle de comparaison, pas une pratique de la Ville.
"""

from __future__ import annotations

from itertools import pairwise
from typing import Any

from optimisation.modeles import Probleme
from optimisation.penalites import penalites_totales


def tournees_ordre_arrivee(
    p: Probleme, ids: set[str] | None = None, avec_limite: bool = True
) -> dict[str, Any]:
    """Arrêts pris du plus ancien au plus récent ; chacun va à l'équipe qui l'atteint le plus tôt.

    `ids` restreint aux arrêts donnés. Avec la limite, un arrêt qui ne tient pas dans le quart (retour au
    garage compris) n'est pas servi ; sans limite, tous le sont et le dépassement est mesuré.
    """
    index = {l.id: i for i, l in enumerate(p.lieux)}
    pen = penalites_totales(p)
    etat = [
        {
            "equipe": e,
            "pos": index[e.garage],
            "t": e.debut_s,
            "noeuds": [index[e.garage]],
            "arrets": [],
        }
        for e in p.equipes
    ]

    def trajet(a: int, b: int) -> int:
        return int(p.temps_s[a][b]) + int(pen[a][b])

    non_servis = []
    for a in sorted(p.arrets, key=lambda x: (x.ordre_arrivee, x.id)):
        if ids is not None and a.id not in ids:
            continue
        k = index[a.id]
        duree = a.intervention_s if a.intervention_s is not None else p.parametres.intervention_s
        meilleur = None
        for s in etat:
            arrivee = s["t"] + trajet(s["pos"], k)
            retour = arrivee + duree + trajet(k, index[s["equipe"].garage])
            if (not avec_limite or retour <= s["equipe"].fin_s) and (
                meilleur is None or arrivee < meilleur[1]
            ):
                meilleur = (s, arrivee, duree)
        if meilleur is None:
            non_servis.append(a.id)
            continue
        s, arrivee, duree = meilleur
        s["arrets"].append(a.id)
        s["noeuds"].append(k)
        s["pos"], s["t"] = k, arrivee + duree
    tournees = []
    for s in etat:
        noeuds = s["noeuds"] + [index[s["equipe"].garage]]
        distance = sum(p.distance_m[x][y] for x, y in pairwise(noeuds))
        retour = s["t"] + (trajet(s["pos"], noeuds[-1]) if len(noeuds) > 1 else 0)
        duree_equipe = int(retour - s["equipe"].debut_s) if s["arrets"] else 0
        tournees.append(
            {
                "equipe_id": s["equipe"].id,
                "arrets": s["arrets"],
                "distance_m": int(distance),
                "duree_s": duree_equipe,
                "depassement_quart_s": max(0, int(retour - s["equipe"].fin_s))
                if s["arrets"]
                else 0,
            }
        )
    return {"tournees": tournees, "non_servis": non_servis}


def _totaux(tournees: list[dict[str, Any]], servis: int) -> dict[str, int]:
    distance = sum(t["distance_m"] for t in tournees)
    return {
        "arrets_servis": servis,
        "distance_m": distance,
        "duree_s": sum(t["duree_s"] for t in tournees),
        "distance_par_arret_m": round(distance / servis) if servis else 0,
    }


def comparer_ordre_arrivee(p: Probleme, optimise: dict[str, Any]) -> dict[str, Any]:
    servis_opt = {a["arret_id"] for t in optimise["tournees"] for a in t["arrets"]}
    egal = tournees_ordre_arrivee(p, servis_opt, avec_limite=False)
    dans_le_quart = tournees_ordre_arrivee(p, None, avec_limite=True)
    servis_quart = sum(len(t["arrets"]) for t in dans_le_quart["tournees"])
    ensemble_quart = {a for t in dans_le_quart["tournees"] for a in t["arrets"]}
    b = _totaux(egal["tournees"], len(servis_opt))
    b["depassement_quart_s"] = sum(t["depassement_quart_s"] for t in egal["tournees"])
    o = _totaux(optimise["tournees"], len(servis_opt))
    return {
        "ordre_arrivee": b,
        "optimise": o,
        # Les arrêts servis dans le quart par l'ordre d'arrivée sont-ils exactement ceux de l'optimisé ?
        # (comparaison des ensembles, pas des nombres). La référence à travail égal, elle, sert toujours les mêmes.
        "memes_arrets_servis": ensemble_quart == servis_opt,
        "distance_gagnee_m": b["distance_m"] - o["distance_m"],
        "duree_gagnee_s": b["duree_s"] - o["duree_s"],
        "arrets_en_plus": len(servis_opt) - servis_quart,
        "dans_le_quart": {
            "ordre_arrivee": servis_quart,
            "optimise": len(servis_opt),
            "arrets_en_plus": len(servis_opt) - servis_quart,
        },
    }
