"""Départ à la position de l'équipe, fin libre ou à un endroit : cas à réponse connue."""

import time
from datetime import UTC, datetime, timedelta
from itertools import pairwise

import httpx
import pytest

from optimisation import matrice_live
from optimisation.ecoute import (
    MESSAGE_FIN_INTROUVABLE,
    MESSAGE_FIN_MANQUANTE,
    ErreurDemande,
    construire_donnees,
    position_fraiche,
)
from optimisation.gain import tournees_ordre_arrivee
from optimisation.matrice_live import Cache, completer_osrm, construire_matrices
from optimisation.modeles import Arret, Equipe, Lieu, Parametres, Probleme
from optimisation.solveur import resoudre

# Une droite : le temps est 10 s par unité, la distance 100 m par unité.
X = {"G": 0, "A": 10, "B": 20, "D": 19, "E": -5}
DEBUT = 1000


def droite(ids, **kwargs):
    lieux = [Lieu(i, 45.5, -73.6 + X[i] * 0.001) for i in ids]
    temps = [[abs(X[a] - X[b]) * 10 for b in ids] for a in ids]
    dist = [[abs(X[a] - X[b]) * 100 for b in ids] for a in ids]
    return lieux, temps, dist


def probleme(ids, arrets, equipes, fin="garage", fin_lieu=None):
    lieux, temps, dist = droite(ids)
    return Probleme(
        lieux,
        temps,
        dist,
        arrets,
        equipes,
        parametres=Parametres(intervention_s=100, limite_s=1.0, fin=fin, fin_lieu=fin_lieu),
    )


def arrets_ab():
    return [Arret("A", "faible", ordre_arrivee=0), Arret("B", "faible", ordre_arrivee=1)]


def sequence(r):
    return [a["arret_id"] for a in r["tournees"][0]["arrets"]]


def test_depart_a_cote_d_un_arret_cet_arret_en_premier():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT, depart="D")
    r = resoudre(probleme(["G", "A", "B", "D"], arrets_ab(), [e]))
    t = r["tournees"][0]
    assert sequence(r) == ["B", "A"]
    assert t["depart"] == "position" and t["fin"] == "garage"
    assert t["lieux"] == ["D", "B", "A", "G"]
    # Le premier trajet part de D (1 unité), le dernier revient au garage (10 unités).
    assert t["distance_m"] == (1 + 10 + 10) * 100
    assert t["trajet_s"] == (1 + 10 + 10) * 10
    assert t["duree_s"] == (1 + 10 + 10) * 10 + 2 * 100
    assert t["depart_position"]["longitude"] == pytest.approx(-73.6 + 19 * 0.001)
    assert t["fin_position"]["longitude"] == pytest.approx(-73.6)


def test_depart_au_garage_par_defaut_et_sortie_inchangee():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT)
    r = resoudre(probleme(["G", "A", "B"], arrets_ab(), [e]))
    t = r["tournees"][0]
    assert sequence(r) == ["A", "B"]
    assert t["lieux"] == ["G", "A", "B", "G"]
    assert t["depart"] == "garage" and t["fin"] == "garage"
    assert t["distance_m"] == (10 + 10 + 20) * 100
    assert r["gain"]["optimise"]["distance_m"] == t["distance_m"]


def test_fin_libre_plus_courte_que_le_retour_au_garage():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT)
    garage = resoudre(probleme(["G", "A", "B"], arrets_ab(), [e]))["tournees"][0]
    libre_r = resoudre(probleme(["G", "A", "B"], arrets_ab(), [e], fin="libre"))
    libre = libre_r["tournees"][0]
    assert [a["arret_id"] for a in libre["arrets"]] == ["A", "B"]
    assert libre["lieux"] == ["G", "A", "B"] and libre["fin"] == "libre"
    assert libre["distance_m"] == (10 + 10) * 100 < garage["distance_m"]
    # Le retour (20 unités, 200 s) n'est plus compté dans la durée.
    assert garage["duree_s"] - libre["duree_s"] == 200
    assert libre["fin_position"]["longitude"] == pytest.approx(-73.6 + 20 * 0.001)
    assert libre_r["non_servis"] == []


def test_fin_libre_aucun_arret_servi():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT)
    r = resoudre(probleme(["G", "A", "B"], [], [e], fin="libre"))
    t = r["tournees"][0]
    assert t["arrets"] == [] and t["distance_m"] == 0 and t["duree_s"] == 0


def test_fin_libre_fait_entrer_plus_d_arrets_dans_le_quart():
    # Quart de 350 s : avec le retour au garage un seul arrêt tient (410 s pour deux), sans retour
    # les deux tiennent (310 s).
    e = Equipe("e", "E", "G", fin_s=DEBUT + 350, debut_s=DEBUT, depart="D")
    ids = ["G", "A", "B", "D"]
    garage = resoudre(probleme(ids, arrets_ab(), [e]))
    libre = resoudre(probleme(ids, arrets_ab(), [e], fin="libre"))
    assert len(garage["tournees"][0]["arrets"]) == 1
    assert len(libre["tournees"][0]["arrets"]) == 2
    assert libre["tournees"][0]["retour_s"] <= DEBUT + 350


def test_fin_a_un_endroit_pour_toutes_les_equipes():
    equipes = [
        Equipe("e1", "E1", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT),
        Equipe("e2", "E2", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT),
    ]
    p = probleme(["G", "A", "B", "E"], arrets_ab(), equipes, fin="endroit", fin_lieu="E")
    r = resoudre(p)
    for t in r["tournees"]:
        assert t["fin"] == "endroit" and t["lieux"][-1] == "E" and t["lieux"][0] == "G"
        assert t["fin_position"]["longitude"] == pytest.approx(-73.6 - 5 * 0.001)
        # La distance compte le dernier trajet jusqu'à l'endroit de fin.
        suite = t["lieux"]
        attendu = sum(abs(X[a] - X[b]) * 100 for a, b in pairwise(suite))
        assert t["distance_m"] == attendu
    assert r["non_servis"] == []
    # Le garage n'est pas un arrêt obligatoire : tout est servi sans nœud inutile.
    assert sum(len(t["arrets"]) for t in r["tournees"]) == 2


def test_reference_ordre_arrivee_part_et_finit_aux_memes_points():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT, depart="D")
    ids = ["G", "A", "B", "D"]
    # Ordre d'arrivée : A (le plus ancien) puis B, en partant de D.
    garage = tournees_ordre_arrivee(probleme(ids, arrets_ab(), [e]), avec_limite=False)
    libre = tournees_ordre_arrivee(probleme(ids, arrets_ab(), [e], fin="libre"), avec_limite=False)
    assert garage["tournees"][0]["arrets"] == ["A", "B"] == libre["tournees"][0]["arrets"]
    assert garage["tournees"][0]["distance_m"] == (9 + 10 + 20) * 100
    assert libre["tournees"][0]["distance_m"] == (9 + 10) * 100
    r = resoudre(probleme(ids, arrets_ab(), [e], fin="libre"))
    assert r["gain"]["ordre_arrivee"]["distance_m"] == (9 + 10) * 100
    assert r["gain"]["optimise"]["distance_m"] == r["tournees"][0]["distance_m"]
    # Le plan optimisé (D, B, A) est plus court que l'ordre d'arrivée (D, A, B).
    assert r["gain"]["optimise"]["distance_m"] == (1 + 10) * 100


def test_validation_des_nouveaux_parametres():
    e = Equipe("e", "E", "G", fin_s=DEBUT + 1000, debut_s=DEBUT)
    with pytest.raises(ValueError, match="lieu de fin"):
        resoudre(probleme(["G", "A", "B"], arrets_ab(), [e], fin="endroit"))
    with pytest.raises(ValueError, match="Fin inconnue"):
        resoudre(probleme(["G", "A", "B"], arrets_ab(), [e], fin="ailleurs"))
    e_depart = Equipe("e", "E", "G", fin_s=DEBUT + 1000, debut_s=DEBUT, depart="Z")
    with pytest.raises(ValueError, match="Départ inconnu"):
        resoudre(probleme(["G", "A", "B"], arrets_ab(), [e_depart]))
    e_arret = Equipe("e", "E", "G", fin_s=DEBUT + 1000, debut_s=DEBUT, depart="A")
    with pytest.raises(ValueError, match="lieu de départ ou de fin"):
        resoudre(probleme(["G", "A", "B"], arrets_ab(), [e_arret]))


def test_depuis_dict_lit_depart_et_fin():
    d = {
        "lieux": [{"id": "G"}, {"id": "A"}, {"id": "E"}],
        "temps_s": [[0, 1, 1]] * 3,
        "distance_m": [[0, 1, 1]] * 3,
        "arrets": [{"id": "A", "gravite": "faible"}],
        "equipes": [{"id": "e", "nom": "E", "garage": "G", "fin_s": 10, "depart": "E"}],
        "parametres": {"fin": "endroit", "fin_lieu": "E"},
    }
    p = Probleme.depuis_dict(d)
    assert p.equipes[0].depart == "E"
    assert p.parametres.fin == "endroit" and p.parametres.fin_lieu == "E"
    assert Probleme.depuis_dict({**d, "parametres": {}}).parametres.fin == "garage"


def test_modele_par_defaut_inchange_sur_petite_instance():
    """Même résultat que le modèle d'avant (garage -> garage) sur une instance où la recherche aboutit."""
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2

    ids = ["G", "A", "B"]
    e = Equipe("e", "E", "G", fin_s=DEBUT + 100_000, debut_s=DEBUT)
    p = probleme(ids, arrets_ab(), [e])
    manager = pywrapcp.RoutingIndexManager(3, 1, [0], [0])
    routing = pywrapcp.RoutingModel(manager)
    service = [0, 100, 100]

    def transit(i, j):
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        return p.temps_s[a][b] + service[a]

    cb = routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(cb)
    routing.AddDimension(cb, 0, DEBUT + 100_000, False, "Temps")
    for a in (1, 2):
        routing.AddDisjunction([manager.NodeToIndex(a)], 10_000)
    sp = pywrapcp.DefaultRoutingSearchParameters()
    sp.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    sp.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    sp.time_limit.FromMilliseconds(500)
    sol = routing.SolveWithParameters(sp)
    i, ancien = routing.Start(0), []
    while not routing.IsEnd(i):
        ancien.append(ids[manager.IndexToNode(i)])
        i = sol.Value(routing.NextVar(i))
    nouveau = resoudre(p)["tournees"][0]["lieux"][:-1]
    assert nouveau == ancien


# ---------- service d'écoute : position des équipes ----------


def ligne_equipe(i="e1"):
    return {
        "id": i,
        "nom": f"Équipe {i}",
        "garage_latitude": 45.51,
        "garage_longitude": -73.57,
        "debut_quart": "08:00:00",
        "fin_quart": "16:00:00",
        "active": True,
    }


def ligne_signalement(i, lat=45.5, lng=-73.56):
    return {
        "id": i,
        "latitude": lat,
        "longitude": lng,
        "grille_id": None,
        "etat": "nouveau",
        "gravite": "faible",
        "cree_le": "2026-11-20T10:00:00Z",
    }


MAINTENANT = datetime(2026, 11, 22, 11, 0, tzinfo=UTC)


def position(equipe_id, age_s, lat=45.502, lng=-73.561):
    return {
        "equipe_id": equipe_id,
        "latitude": lat,
        "longitude": lng,
        "maj_le": (MAINTENANT - timedelta(seconds=age_s)).isoformat(),
    }


def test_position_fraiche_et_perimee():
    assert position_fraiche([position("e1", 60)], "e1", MAINTENANT) == (45.502, -73.561)
    assert position_fraiche([position("e1", 14 * 60)], "e1", MAINTENANT) is not None
    assert position_fraiche([position("e1", 16 * 60)], "e1", MAINTENANT) is None
    assert position_fraiche([position("e1", -3600)], "e1", MAINTENANT) is None  # dans le futur
    assert position_fraiche([position("e2", 60)], "e1", MAINTENANT) is None
    assert position_fraiche(None, "e1", MAINTENANT) is None
    assert (
        position_fraiche([{"equipe_id": "e1", "maj_le": "pas une date"}], "e1", MAINTENANT) is None
    )
    # La plus récente gagne.
    recente = position("e1", 30, lat=45.503)
    assert position_fraiche([position("e1", 600), recente], "e1", MAINTENANT) == (45.503, -73.561)


def test_depart_position_fraiche_ou_garage_selon_l_age():
    equipes = [ligne_equipe("e1"), ligne_equipe("e2")]
    positions = [position("e1", 120), position("e2", 20 * 60)]
    donnees, _, _ = construire_donnees(
        {"depart": "position", "date": "2026-11-22"},
        equipes,
        [],
        [ligne_signalement("s1")],
        None,
        MAINTENANT,
        positions=positions,
    )
    p = donnees.probleme
    departs = {e.id: e.depart for e in p.equipes}
    assert departs == {"e1": "depart:e1", "e2": None}  # position de plus de 15 minutes : garage
    lieu = next(x for x in p.lieux if x.id == "depart:e1")
    assert (lieu.latitude, lieu.longitude) == (45.502, -73.561)
    r = resoudre(p)
    par_equipe = {t["equipe_id"]: t for t in r["tournees"]}
    assert par_equipe["e1"]["depart"] == "position"
    assert par_equipe["e1"]["depart_position"] == {"latitude": 45.502, "longitude": -73.561}
    assert par_equipe["e2"]["depart"] == "garage"
    assert par_equipe["e2"]["depart_position"] == {"latitude": 45.51, "longitude": -73.57}


def test_depart_garage_par_defaut_ignore_les_positions():
    donnees, _, _ = construire_donnees(
        {"date": "2026-11-22"},
        [ligne_equipe()],
        [],
        [ligne_signalement("s1")],
        None,
        MAINTENANT,
        positions=[position("e1", 10)],
    )
    assert donnees.probleme.equipes[0].depart is None
    assert not any(x.id.startswith("depart:") for x in donnees.probleme.lieux)


def test_fin_endroit_dans_la_demande():
    base = {"date": "2026-11-22", "fin": "endroit"}
    sigs = [ligne_signalement("s1"), ligne_signalement("s2", lat=45.505)]
    with pytest.raises(ErreurDemande, match=MESSAGE_FIN_MANQUANTE):
        construire_donnees(base, [ligne_equipe()], [], sigs, None, MAINTENANT)
    with pytest.raises(ErreurDemande, match=MESSAGE_FIN_INTROUVABLE):
        construire_donnees(
            {**base, "fin_cle_endroit": "inconnu"}, [ligne_equipe()], [], sigs, None, MAINTENANT
        )
    cle_ouverte = "case:45.5000:-73.5600"
    donnees, _, _ = construire_donnees(
        {**base, "fin_cle_endroit": cle_ouverte}, [ligne_equipe()], [], sigs, None, MAINTENANT
    )
    p = donnees.probleme
    assert p.parametres.fin == "endroit" and p.parametres.fin_lieu == f"fin:{cle_ouverte}"
    # L'endroit de fin est aussi un arrêt : on le dessert, puis on y finit.
    r = resoudre(p)
    assert r["tournees"][0]["lieux"][-1] == f"fin:{cle_ouverte}"
    assert sum(len(t["arrets"]) for t in r["tournees"]) == 2
    # Une case hors des endroits ouverts se résout par ses coordonnées.
    donnees, _, _ = construire_donnees(
        {**base, "fin_cle_endroit": "case:45.5200:-73.5800"},
        [ligne_equipe()],
        [],
        sigs,
        None,
        MAINTENANT,
    )
    fin = next(x for x in donnees.probleme.lieux if x.id == donnees.probleme.parametres.fin_lieu)
    assert (fin.latitude, fin.longitude) == (45.52, -73.58)


def test_fin_inconnue_refusee_dans_la_demande():
    with pytest.raises(ErreurDemande):
        construire_donnees(
            {"date": "2026-11-22", "fin": "ailleurs"},
            [ligne_equipe()],
            [],
            [ligne_signalement("s1")],
            None,
            MAINTENANT,
        )


def test_fin_libre_et_depart_position_dans_la_demande():
    donnees, _, _ = construire_donnees(
        {"date": "2026-11-22", "depart": "position", "fin": "libre"},
        [ligne_equipe()],
        [],
        [ligne_signalement("s1"), ligne_signalement("s2", lat=45.506)],
        None,
        MAINTENANT,
        positions=[position("e1", 30)],
    )
    r = resoudre(donnees.probleme)
    t = r["tournees"][0]
    assert t["depart"] == "position" and t["fin"] == "libre"
    assert t["lieux"][0] == "depart:e1" and not t["lieux"][-1].startswith("garage")
    assert r["non_servis"] == []


# ---------- OSRM table pour les lieux hors cache ----------


@pytest.fixture(autouse=True)
def memoire_vide():
    matrice_live.vider_memoire()
    yield
    matrice_live.vider_memoire()


def lieux_hors_cache(n):
    return [Lieu(f"L{i}", 45.50 + i * 0.0001, -73.57) for i in range(n)]


def client_osrm(journal, code=200, nulles=False, latence=0.0):
    def gestionnaire(requete: httpx.Request) -> httpx.Response:
        journal.append((time.monotonic(), requete))
        if latence:
            time.sleep(latence)
        if code != 200:
            return httpx.Response(code)
        coords = requete.url.path.rsplit("/", 1)[-1].split(";")
        assert len(coords) <= 100
        k = len(coords)
        d = [[0 if a == b else (None if nulles else 7.0) for b in range(k)] for a in range(k)]
        m = [[0 if a == b else (None if nulles else 70.0) for b in range(k)] for a in range(k)]
        return httpx.Response(200, json={"code": "Ok", "durations": d, "distances": m})

    return httpx.Client(transport=httpx.MockTransport(gestionnaire))


def matrices_vol(lieux):
    temps, dist, _, source = construire_matrices(lieux, None)
    return temps, dist, source


def completer(lieux, lignes, colonnes, client, **kw):
    temps, dist, _ = matrices_vol(lieux)
    kw.setdefault("ecart_s", 0)
    resultat = completer_osrm(lieux, temps, dist, lignes, colonnes, client, memoire={}, **kw)
    return temps, dist, resultat


def test_osrm_ligne_d_un_depart_en_blocs_de_100_coordonnees():
    lieux = lieux_hors_cache(150)
    journal: list = []
    temps, _, (requetes, remplacees) = completer(lieux, [0], [], client_osrm(journal))
    # 1 nouveau lieu et 149 autres : blocs de 99, donc 2 requêtes ; seule la ligne du départ change.
    assert requetes == 2 == len(journal)
    assert all("table/v1/driving" in str(r.url) for _, r in journal)
    assert len(remplacees) == 149 and all(i == 0 for i, _ in remplacees)
    assert temps[0][1] == 7 and temps[1][0] != 7


def test_osrm_colonne_d_une_fin():
    lieux = lieux_hors_cache(10)
    temps, _, (requetes, remplacees) = completer(lieux, [], [9], client_osrm([]))
    assert requetes == 1 and len(remplacees) == 9
    assert all(temps[i][9] == 7 for i in range(9)) and temps[9][0] != 7


def test_osrm_nouvel_arret_ligne_et_colonne_seulement():
    lieux = lieux_hors_cache(30)
    temps, dist, (requetes, remplacees) = completer(lieux, [5], [5], client_osrm([]))
    assert requetes == 1 and len(remplacees) == 2 * 29
    assert temps[5][0] == 7 and temps[0][5] == 7 and dist[5][29] == 70
    assert temps[1][2] != 7  # une paire entre deux lieux connus n'est pas redemandée


def test_osrm_nouveaux_lieux_entre_eux_une_seule_fois():
    lieux = lieux_hors_cache(6)
    temps, _, (requetes, remplacees) = completer(lieux, [0, 1], [0, 1], client_osrm([]))
    assert requetes == 1 and temps[0][1] == 7 and temps[1][0] == 7
    assert len(remplacees) == 2 * 5 + 2 * 4


def test_osrm_memoire_evite_de_redemander_les_paires():
    lieux = lieux_hors_cache(12)
    journal: list = []
    memoire: dict = {}
    t1, d1, _ = matrices_vol(lieux)
    r1 = completer_osrm(lieux, t1, d1, [3], [3], client_osrm(journal), memoire=memoire, ecart_s=0)
    t2, d2, _ = matrices_vol(lieux)
    r2 = completer_osrm(lieux, t2, d2, [3], [3], client_osrm(journal), memoire=memoire, ecart_s=0)
    assert r1[0] == 1 and r2[0] == 0 and len(journal) == 1
    assert r2[1] == r1[1] and t2 == t1 and d2 == d1
    # La mémoire est par coordonnées : un autre identifiant au même endroit profite des paires.
    renomme = [Lieu(f"autre{i}", l.latitude, l.longitude) for i, l in enumerate(lieux)]
    t3, d3, _ = matrices_vol(renomme)
    assert completer_osrm(renomme, t3, d3, [3], [3], client_osrm(journal), memoire=memoire)[0] == 0
    assert t3 == t1


def test_osrm_memoire_du_service_par_defaut():
    lieux = lieux_hors_cache(8)
    journal: list = []
    temps, dist, _ = matrices_vol(lieux)
    completer_osrm(lieux, temps, dist, [2], [2], client_osrm(journal), ecart_s=0)
    temps2, dist2, _ = matrices_vol(lieux)
    completer_osrm(lieux, temps2, dist2, [2], [2], client_osrm(journal), ecart_s=0)
    assert len(journal) == 1 and temps2 == temps


def test_osrm_complet_au_plus_une_requete_par_seconde():
    lieux = lieux_hors_cache(150)
    journal: list = []
    completer(lieux, [0], [], client_osrm(journal), ecart_s=0.3)
    debuts = [t for t, _ in journal]
    assert len(debuts) == 2 and debuts[1] - debuts[0] >= 0.29


def test_osrm_lent_plafond_de_temps_puis_vol_d_oiseau():
    # 1 nouveau lieu et 300 autres : 4 blocs de 99 ; chaque réponse prend 0,4 s pour un plafond de 0,5 s.
    lieux = lieux_hors_cache(301)
    journal: list = []
    debut = time.monotonic()
    temps, _, (requetes, remplacees) = completer(
        lieux, [0], [], client_osrm(journal, latence=0.4), delai_max_s=0.5, ecart_s=0.05
    )
    assert time.monotonic() - debut < 1.2
    assert requetes < 4 and 0 < len(remplacees) < 300
    sans = matrices_vol(lieux)[0]
    manquantes = [j for j in range(1, 301) if (0, j) not in remplacees]
    assert manquantes and all(temps[0][j] == sans[0][j] != 7 for j in manquantes)


def test_osrm_en_panne_ou_sans_valeurs_garde_le_vol_d_oiseau():
    lieux = lieux_hors_cache(5)
    avant = matrices_vol(lieux)[0]
    for client in (client_osrm([], code=500), client_osrm([], nulles=True)):
        temps, _, (requetes, remplacees) = completer(lieux, [0], [], client)
        assert requetes == 1 and remplacees == set() and temps == avant


def test_osrm_trop_de_nouveaux_lieux_pas_de_requete():
    lieux = lieux_hors_cache(120)
    journal: list = []
    _, _, (requetes, remplacees) = completer(
        lieux, list(range(100)), list(range(100)), client_osrm(journal)
    )
    assert requetes == 0 and remplacees == set() and journal == []


def cache_de(lieux):
    return Cache(
        ids=[l.id for l in lieux],
        positions=[(l.latitude, l.longitude) for l in lieux],
        temps_s=[[0 if i == j else 50 for j in range(len(lieux))] for i in range(len(lieux))],
        distance_m=[[0 if i == j else 500 for j in range(len(lieux))] for i in range(len(lieux))],
        permis=[],
        rayon_m=30,
        plafond_s=600,
        penalite_arret_s={},
        source="osrm",
        index={l.id: i for i, l in enumerate(lieux)},
    )


def test_source_selon_ce_qui_reste_estime():
    connus = lieux_hors_cache(3)
    cache = cache_de(connus)
    nouveau = Lieu("nouveau", 45.5123, -73.5555)
    tous = [*connus, nouveau]
    # Un nouvel arrêt complété par OSRM : plus aucune paire estimée.
    t, _, _, source = construire_matrices(tous, cache, client_osrm([]))
    assert source == "osrm_cache" and t[3][0] == 7 and t[0][3] == 7 and t[0][1] == 50
    # OSRM en panne (et rien en mémoire) : le nouvel arrêt reste à vol d'oiseau et la source le dit.
    matrice_live.vider_memoire()
    assert construire_matrices(tous, cache, client_osrm([], code=500))[3] == "vol_oiseau"
    matrice_live.vider_memoire()
    assert construire_matrices(tous, cache, None)[3] == "vol_oiseau"
    # Sans cache du tout, tout venu d'OSRM : « osrm ».
    matrice_live.vider_memoire()
    assert construire_matrices(lieux_hors_cache(3), None, client_osrm([]))[3] == "osrm"


def test_depart_seul_ne_demande_que_sa_ligne_et_la_source_reste_osrm_cache():
    connus = lieux_hors_cache(3)
    cache = cache_de(connus)
    depart = Lieu("depart:e1", 45.5123, -73.5555)
    tous = [*connus, depart]
    journal: list = []
    t, _, _, source = construire_matrices(tous, cache, client_osrm(journal), [3], [])
    assert source == "osrm_cache" and len(journal) == 1
    assert t[3][0] == 7 and t[0][3] != 7  # on n'arrive jamais au départ : sa colonne reste estimée


def test_osrm_panne_au_depart_la_source_le_dit():
    connus = lieux_hors_cache(3)
    cache = cache_de(connus)
    tous = [*connus, Lieu("depart:e1", 45.5123, -73.5555)]
    assert construire_matrices(tous, cache, client_osrm([], code=500), [3], [])[3] == "vol_oiseau"


def test_cas_de_demo_par_defaut_inchange():
    """Garage -> garage, 8 s : 177 arrêts, aucun grave non servi, environ 77 km. La recherche étant
    limitée par le temps, la distance varie d'une relance à l'autre (de 76 800 à 77 700 m mesurés)."""
    from optimisation.entrees import charger_probleme

    p = charger_probleme(limite_s=8)
    r = resoudre(p)
    graves = {a.id for a in p.arrets if a.gravite != "faible"}
    assert r["statut"] == "ok" and r["gain"]["optimise"]["arrets_servis"] == 177
    assert not graves & set(r["non_servis"])
    assert 76_000 <= r["gain"]["optimise"]["distance_m"] <= 78_500
    assert {t["depart"] for t in r["tournees"]} == {"garage"}
    assert {t["fin"] for t in r["tournees"]} == {"garage"}
    assert all(t["lieux"][0] == t["lieux"][-1] for t in r["tournees"])


def test_demande_complete_depart_position_et_position_perimee():
    from test_optimisation_ecoute import FauxMagasin, demande, equipe, sig

    class AvecPositions(FauxMagasin):
        def __init__(self, positions, **kw):
            super().__init__(**kw)
            self._positions = positions

        def positions_equipes(self):
            return self._positions

    def lancer(age_s):
        maintenant = datetime.now(UTC)
        pos = {
            "equipe_id": "e1",
            "latitude": 45.5012,
            "longitude": -73.5611,
            "maj_le": (maintenant - timedelta(seconds=age_s)).isoformat(),
        }
        m = AvecPositions(
            [pos],
            demandes=[demande(depart="position", fin="libre")],
            equipes=[equipe("e1")],
            signalements=[sig("s1", lat=45.5011, lng=-73.5612), sig("s2", lat=45.52, lng=-73.58)],
        )
        from optimisation.ecoute import traiter_demande

        traiter_demande(m, m.demandes["d1"], None, utiliser_osrm=False, journal=lambda *_: None)
        return m.tournees["d1"]["tournees"][0]

    frais = lancer(60)
    assert frais["depart"] == "position" and frais["fin"] == "libre"
    assert frais["depart_position"] == {"latitude": 45.5012, "longitude": -73.5611}
    # L'arrêt tout près de la position de l'équipe est servi en premier.
    assert frais["arrets"][0]["position"]["latitude"] == pytest.approx(45.5011)
    perime = lancer(30 * 60)
    assert perime["depart"] == "garage"
    assert perime["depart_position"] == {"latitude": 45.51, "longitude": -73.57}
