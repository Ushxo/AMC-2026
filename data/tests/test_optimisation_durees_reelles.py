"""Durées sorties réelles (route plus interventions) ; pénalités de chantier limitées aux rues barrées."""

from datetime import UTC, datetime
from itertools import pairwise

import pytest
from test_optimisation_ecoute import equipe, sig

from optimisation import matrice_live
from optimisation.ecoute import (
    MESSAGE_PENALITES_INCONNUES,
    PENALITES_DEFAUT,
    ErreurDemande,
    construire_donnees,
)
from optimisation.gain import tournees_ordre_arrivee
from optimisation.matrice_live import Cache, construire_matrices
from optimisation.modeles import Arret, Equipe, Lieu, Parametres, Probleme
from optimisation.solveur import resoudre

# Une droite : 10 s et 100 m par unité ; interventions de 100 s.
X = {"G": 0, "A": 10, "B": 20, "C": 30}
DEBUT = 1000


def probleme(arrets, penalites=None, fin_s=DEBUT + 100_000):
    ids = ["G", "A", "B", "C"]
    lieux = [Lieu(i, 45.5, -73.6 + X[i] * 0.001) for i in ids]
    temps = [[abs(X[a] - X[b]) * 10 for b in ids] for a in ids]
    dist = [[abs(X[a] - X[b]) * 100 for b in ids] for a in ids]
    return Probleme(
        lieux,
        temps,
        dist,
        arrets,
        [Equipe("e", "E", "G", fin_s=fin_s, debut_s=DEBUT)],
        penalites_s=penalites,
        parametres=Parametres(intervention_s=100, limite_s=1.0),
    )


def arrets():
    return [Arret(i, "faible", ordre_arrivee=r) for r, i in enumerate("ABC")]


def test_durees_et_heures_sans_les_penalites_du_modele():
    pen = [[0] * 4 for _ in range(4)]
    pen[1][2] = pen[2][1] = 5000  # A <-> B : gros détour estimé, évité si possible
    p = probleme(arrets(), pen)
    r = resoudre(p)
    t = r["tournees"][0]
    suite = [a["arret_id"] for a in t["arrets"]]
    noeuds = [0, *[["G", "A", "B", "C"].index(a) for a in suite], 0]
    route = sum(p.temps_s[a][b] for a, b in pairwise(noeuds))
    assert t["trajet_s"] == route and t["duree_s"] == route + 3 * 100
    assert t["retour_s"] == DEBUT + route + 300 and t["duree_s"] == t["retour_s"] - DEBUT
    # Les heures de passage sont du temps réel : route plus interventions, sans pénalité.
    attendu = DEBUT
    precedent = 0
    for a in t["arrets"]:
        n = ["G", "A", "B", "C"].index(a["arret_id"])
        attendu += p.temps_s[precedent][n]
        assert a["arrivee_s"] == attendu
        attendu += 100
        assert a["depart_s"] == attendu
        precedent = n
    # L'ordre choisi évite l'arc pénalisé : A et B ne se suivent pas.
    assert all(pen[a][b] == 0 for a, b in pairwise(noeuds))


def test_les_penalites_restent_dans_l_objectif_et_changent_l_ordre():
    pen = [[0] * 4 for _ in range(4)]
    for a, b in ((0, 1), (1, 0)):
        pen[a][b] = 5000  # sortir du garage vers A est « pénalisé »
    ordre_sans = [a["arret_id"] for a in resoudre(probleme(arrets()))["tournees"][0]["arrets"]]
    ordre_avec = [a["arret_id"] for a in resoudre(probleme(arrets(), pen))["tournees"][0]["arrets"]]
    assert ordre_sans[0] == "A" and ordre_avec[0] != "A"


def test_la_reference_ordre_d_arrivee_donne_aussi_des_durees_reelles():
    pen = [[0] * 4 for _ in range(4)]
    pen[0][1] = pen[1][0] = 5000
    p = probleme(arrets(), pen)
    ref = tournees_ordre_arrivee(p, avec_limite=False)["tournees"][0]
    # A, B, C dans l'ordre d'arrivée, depuis et vers le garage : route 10 + 10 + 10 + 30 unités.
    assert ref["arrets"] == ["A", "B", "C"]
    assert ref["distance_m"] == (10 + 10 + 10 + 30) * 100
    assert ref["duree_s"] == (10 + 10 + 10 + 30) * 10 + 3 * 100  # aucune pénalité de 5 000 s
    r = resoudre(p)
    c = r["gain"]
    assert c["ordre_arrivee"]["duree_s"] == ref["duree_s"]
    assert c["optimise"]["duree_s"] == r["tournees"][0]["duree_s"]
    assert c["duree_gagnee_s"] == c["ordre_arrivee"]["duree_s"] - c["optimise"]["duree_s"]


def test_le_quart_reste_tenu_par_le_temps_reel():
    pen = [[0] * 4 for _ in range(4)]
    pen[0][1] = pen[1][0] = 100
    r = resoudre(probleme(arrets(), pen, fin_s=DEBUT + 1000))
    for t in r["tournees"]:
        assert t["retour_s"] <= DEBUT + 1000


# ---------- pénalités de chantier : rues barrées seulement ----------


def cache_avec_permis():
    lieux = [
        Lieu("A", 45.5000, -73.5700),
        Lieu("B", 45.5000, -73.5600),
        Lieu("C", 45.5100, -73.5700),
    ]
    permis = [
        {
            "id": "p1",
            "latitude": 45.5000,
            "longitude": -73.5650,
            "penalite_s": 300,
            "type_impact": "Rue barrée",
        },
        {
            "id": "p2",
            "latitude": 45.5050,
            "longitude": -73.5700,
            "penalite_s": 120,
            "type_impact": "Voie de circulation obstruée",
        },
    ]
    return lieux, Cache(
        ids=[l.id for l in lieux],
        positions=[(l.latitude, l.longitude) for l in lieux],
        temps_s=[[0 if i == j else 60 for j in range(3)] for i in range(3)],
        distance_m=[[0 if i == j else 600 for j in range(3)] for i in range(3)],
        permis=permis,
        rayon_m=30,
        plafond_s=600,
        penalite_arret_s={},
        source="osrm",
        index={l.id: i for i, l in enumerate(lieux)},
    )


def test_types_penalises_selectionnent_les_permis():
    lieux, cache = cache_avec_permis()
    toutes = construire_matrices(lieux, cache)[2]
    barrees = construire_matrices(lieux, cache, types_penalises=frozenset({"Rue barrée"}))[2]
    aucune = construire_matrices(lieux, cache, types_penalises=frozenset())[2]
    # A <-> B passe par la rue barrée (300 s) ; A <-> C par la voie obstruée (120 s).
    assert toutes[0][1] == 300 and toutes[0][2] == 120
    assert barrees[0][1] == 300 and barrees[0][2] == 0
    assert all(v == 0 for ligne in aucune for v in ligne)


def donnees(params, cache):
    sigs = [
        sig("s1", lat=45.5000, lng=-73.5700, grille="A"),
        sig("s2", lat=45.5000, lng=-73.5600, grille="B"),
    ]
    return construire_donnees(
        {"date": "2026-11-22", **params},
        [{**equipe("e1", 45.5100, -73.5700)}],
        [],
        sigs,
        cache,
        datetime(2026, 11, 22, 11, 0, tzinfo=UTC),
    )[0].probleme


def test_calculs_en_direct_rues_barrees_seulement_par_defaut():
    assert PENALITES_DEFAUT == "barrees"
    _, cache = cache_avec_permis()
    par_defaut = donnees({}, cache)
    ids = [l.id for l in par_defaut.lieux]
    a, b, c = ids.index("grille:A"), ids.index("grille:B"), 0  # 0 : le garage, au point C
    assert par_defaut.penalites_s[a][b] == 300 and par_defaut.penalites_s[a][c] == 0
    toutes = donnees({"penalites": "toutes"}, cache)
    assert toutes.penalites_s[ids.index("grille:A")][0] == 120
    aucune = donnees({"penalites": "aucune"}, cache)
    assert all(v == 0 for ligne in aucune.penalites_s for v in ligne)


def test_penalites_inconnues_refusees():
    _, cache = cache_avec_permis()
    with pytest.raises(ErreurDemande, match=MESSAGE_PENALITES_INCONNUES):
        donnees({"penalites": "beaucoup"}, cache)


def test_precalcule_garde_toutes_les_penalites():
    """Le chargement du précalculé (entrees.py) n'est pas touché : il lit penalites.json tel quel."""
    from optimisation.entrees import charger_probleme

    p = charger_probleme()
    permis = matrice_live.charger_cache().permis
    assert {x["type_impact"] for x in permis} == {
        "Rue barrée",
        "Voie de circulation obstruée",
        "Voie de stationnement et voie de circulation obstruées",
    }
    assert sum(1 for ligne in p.penalites_s for v in ligne if v > 0) > 20_000
