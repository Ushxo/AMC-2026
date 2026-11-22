"""Tournées des équipes : fonction pure, entrée et sortie JSON, sans réseau ni base de données."""

from __future__ import annotations

import time
from dataclasses import replace
from itertools import pairwise
from typing import Any

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from optimisation.gain import comparer_ordre_arrivee
from optimisation.modeles import GRAVITES, Probleme, fin_de_equipe
from optimisation.penalites import penalites_totales

FINS = ("garage", "libre", "endroit")


def valider(p: Probleme) -> None:
    n = len(p.lieux)
    ids = [l.id for l in p.lieux]
    if len(set(ids)) != n:
        raise ValueError("Les identifiants de lieux ne sont pas uniques.")
    for nom, m in (
        ("temps_s", p.temps_s),
        ("distance_m", p.distance_m),
        ("penalites_s", p.penalites_s),
    ):
        if m is None and nom == "penalites_s":
            continue
        if len(m) != n or any(len(r) != n for r in m):
            raise ValueError(f"La matrice {nom} doit être de taille {n} x {n}.")
    if not p.equipes:
        raise ValueError("Il faut au moins une équipe.")
    garages = {e.garage for e in p.equipes}
    departs = {e.depart for e in p.equipes if e.depart is not None}
    fin = p.parametres.fin
    if fin not in FINS:
        raise ValueError(f"Fin inconnue : {fin}.")
    if fin == "endroit" and p.parametres.fin_lieu not in ids:
        raise ValueError("Il faut un lieu de fin connu quand la fin est un endroit.")
    lieu_fin = {p.parametres.fin_lieu} if fin == "endroit" else set()
    for e in p.equipes:
        if e.fin not in (None, "garage", "libre", "arrivee"):
            raise ValueError(f"Fin inconnue pour l'équipe {e.id} : {e.fin}.")
        if e.fin == "arrivee":
            if e.fin_lieu not in ids:
                raise ValueError(f"Il faut un lieu d'arrivée connu pour l'équipe {e.id}.")
            lieu_fin.add(e.fin_lieu)
        if e.garage not in ids:
            raise ValueError(f"Garage inconnu : {e.garage}.")
        if e.depart is not None and e.depart not in ids:
            raise ValueError(f"Départ inconnu : {e.depart}.")
        if e.fin_s <= e.debut_s:
            raise ValueError(f"Le quart de l'équipe {e.id} est vide.")
    if len({e.id for e in p.equipes}) != len(p.equipes):
        raise ValueError("Les identifiants d'équipes ne sont pas uniques.")
    for a in p.arrets:
        if a.id not in ids:
            raise ValueError(f"Arrêt inconnu dans les lieux : {a.id}.")
        if a.id in garages:
            raise ValueError(f"Un arrêt ne peut pas être un garage : {a.id}.")
        if a.id in departs or a.id in lieu_fin:
            raise ValueError(f"Un arrêt ne peut pas être un lieu de départ ou de fin : {a.id}.")
        if a.gravite not in GRAVITES:
            raise ValueError(f"Gravité inconnue : {a.gravite}.")
    if len({a.id for a in p.arrets}) != len(p.arrets):
        raise ValueError("Les identifiants d'arrêts ne sont pas uniques.")
    if not 0 < p.parametres.limite_s <= 60:
        raise ValueError("La limite de calcul doit être entre 0 et 60 secondes.")
    _refuser_negatifs(p)


def _refuser_negatifs(p: Probleme) -> None:
    """Durées, distances, pénalités, interventions et poids doivent être des entiers positifs ou nuls."""
    for nom, m in (
        ("temps_s", p.temps_s),
        ("distance_m", p.distance_m),
        ("penalites_s", p.penalites_s),
    ):
        if m is not None and any(v < 0 for ligne in m for v in ligne):
            raise ValueError(f"La matrice {nom} contient une valeur négative.")
    if p.parametres.intervention_s < 0:
        raise ValueError("Le temps d'intervention ne peut pas être négatif.")
    if any(a.intervention_s is not None and a.intervention_s < 0 for a in p.arrets):
        raise ValueError("Le temps d'intervention d'un arrêt ne peut pas être négatif.")
    if any(v < 0 for v in p.parametres.penalite_non_visite.values()):
        raise ValueError("Une pénalité de non-visite ne peut pas être négative.")
    if p.parametres.equilibrage < 0:
        raise ValueError("Le poids d'équilibrage ne peut pas être négatif.")
    for i in p.incidents:
        if i.penalite_s < 0 or i.rayon_m <= 0:
            raise ValueError("Un incident a une pénalité négative ou un rayon nul.")
    if any(e.debut_s < 0 for e in p.equipes):
        raise ValueError("Le début d'un quart ne peut pas être négatif.")


def reduire(p: Probleme) -> Probleme:
    """Ne garde que les départs, les fins et les arrêts retenus : aucun autre point de la matrice
    ne peut devenir une visite (un lieu qui n'est ni départ ni fin serait un arrêt obligatoire),
    et les distances affichées sont celles du plan réellement calculé."""
    utiles = {e.depart or e.garage for e in p.equipes} | {a.id for a in p.arrets}
    for e in p.equipes:
        lieu = fin_de_equipe(p.parametres, e)[1]
        if lieu:
            utiles.add(lieu)
    gardes = [i for i, lieu in enumerate(p.lieux) if lieu.id in utiles]
    if len(gardes) == len(p.lieux):
        return p

    def sous(m):
        return None if m is None else [[m[i][j] for j in gardes] for i in gardes]

    return replace(
        p,
        lieux=[p.lieux[i] for i in gardes],
        temps_s=sous(p.temps_s),
        distance_m=sous(p.distance_m),
        penalites_s=sous(p.penalites_s),
    )


def resoudre(p: Probleme) -> dict[str, Any]:
    """Calcule les tournées. Rend un dictionnaire sérialisable en JSON."""
    valider(p)
    p = reduire(p)
    debut_calcul = time.monotonic()
    ids = [l.id for l in p.lieux]
    index = {id_: i for i, id_ in enumerate(ids)}
    pen = penalites_totales(p)
    temps_s = p.temps_s
    n = len(ids)
    modes = [fin_de_equipe(p.parametres, e) for e in p.equipes]

    if any(mode == "libre" for mode, _ in modes):
        # Nœud de fin fictif : on y arrive de n'importe où sans coût (le temps de service du dernier
        # arrêt compte quand même), donc la tournée s'arrête au dernier arrêt.
        ids = [*ids, "fin-libre"]
        index["fin-libre"] = n
        pen = [[*ligne, 0] for ligne in pen] + [[0] * (n + 1)]
        temps_s = [[*ligne, 0] for ligne in temps_s] + [[0] * (n + 1)]
        n += 1

    service = [0] * n
    for a in p.arrets:
        service[index[a.id]] = (
            a.intervention_s if a.intervention_s is not None else p.parametres.intervention_s
        )

    starts = [index[e.depart or e.garage] for e in p.equipes]
    ends = [index["fin-libre"] if mode == "libre" else index[lieu] for mode, lieu in modes]
    manager = pywrapcp.RoutingIndexManager(n, len(p.equipes), starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    def transit(i: int, j: int) -> int:
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        return int(temps_s[a][b]) + pen[a][b] + service[a]

    cb = routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(cb)
    horizon = max(e.fin_s for e in p.equipes)
    routing.AddDimension(cb, 0, horizon, False, "Temps")
    temps = routing.GetDimensionOrDie("Temps")
    for v, e in enumerate(p.equipes):
        temps.CumulVar(routing.Start(v)).SetRange(e.debut_s, e.debut_s)
        temps.CumulVar(routing.End(v)).SetRange(e.debut_s, e.fin_s)
    if p.parametres.equilibrage:
        temps.SetGlobalSpanCostCoefficient(p.parametres.equilibrage)

    for a in p.arrets:
        routing.AddDisjunction(
            [manager.NodeToIndex(index[a.id])], p.parametres.penalite_non_visite[a.gravite]
        )

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromMilliseconds(int(p.parametres.limite_s * 1000))

    solution = None
    if p.tournees_initiales:
        routing.CloseModelWithParameters(params)
        connus = {a.id for a in p.arrets}
        routes = [
            [
                manager.NodeToIndex(index[a])
                for a in p.tournees_initiales.get(e.id, [])
                if a in connus
            ]
            for e in p.equipes
        ]
        initiale = routing.ReadAssignmentFromRoutes(routes, True)
        if initiale is not None:
            solution = routing.SolveFromAssignmentWithParameters(initiale, params)
    if solution is None:
        solution = routing.SolveWithParameters(params)
    if solution is None:
        return _vide(p, time.monotonic() - debut_calcul)

    arrets_par_id = {a.id: a for a in p.arrets}
    tournees = []
    servis: set[str] = set()
    for v, e in enumerate(p.equipes):
        i = routing.Start(v)
        suite: list[dict[str, Any]] = []
        noeuds = [starts[v]]
        while not routing.IsEnd(i):
            node = manager.IndexToNode(i)
            if ids[node] in arrets_par_id:
                arrivee = solution.Value(temps.CumulVar(i))
                suite.append(
                    {
                        "arret_id": ids[node],
                        "ordre": len(suite) + 1,
                        "arrivee_s": arrivee,
                        "depart_s": arrivee + service[node],
                    }
                )
                servis.add(ids[node])
                noeuds.append(node)
            i = solution.Value(routing.NextVar(i))
        if modes[v][0] != "libre":
            noeuds.append(ends[v])
        retour = solution.Value(temps.CumulVar(i))
        tournees.append(_tournee(e, suite, noeuds, retour, p, modes[v][0]))

    non_servis = [a.id for a in p.arrets if a.id not in servis]
    resultat: dict[str, Any] = {
        "statut": "ok",
        "tournees": tournees,
        "non_servis": non_servis,
        "duree_calcul_s": round(time.monotonic() - debut_calcul, 3),
    }
    resultat["gain"] = comparer_ordre_arrivee(p, resultat)
    return resultat


def _position(p: Probleme, k: int) -> dict[str, float | None]:
    return {"latitude": p.lieux[k].latitude, "longitude": p.lieux[k].longitude}


def _tournee(e, suite, noeuds, retour_s, p: Probleme, mode_fin: str) -> dict[str, Any]:
    """Distance, temps de trajet et durée : le premier trajet part du départ réel de l'équipe et
    le dernier va jusqu'à la fin réelle (retour au garage, endroit de fin, ou dernier arrêt)."""
    distance = sum(p.distance_m[a][b] for a, b in pairwise(noeuds))
    trajet = sum(p.temps_s[a][b] for a, b in pairwise(noeuds))
    return {
        "equipe_id": e.id,
        "equipe_nom": e.nom,
        "arrets": suite,
        "distance_m": int(distance),
        "trajet_s": int(trajet),
        "retour_s": int(retour_s),
        "duree_s": int(retour_s - e.debut_s),
        "lieux": [p.lieux[k].id for k in noeuds],
        "depart": "position" if e.depart else "garage",
        "depart_position": _position(p, noeuds[0]),
        "fin": mode_fin,
        "fin_position": _position(p, noeuds[-1]),
        "fin_nom": e.fin_nom if mode_fin == "arrivee" else None,
    }


def _vide(p: Probleme, duree: float) -> dict[str, Any]:
    return {
        "statut": "aucune_solution",
        "tournees": [],
        "non_servis": [a.id for a in p.arrets],
        "duree_calcul_s": round(duree, 3),
        "gain": None,
    }
