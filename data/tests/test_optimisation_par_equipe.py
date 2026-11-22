"""Départ et fin choisis équipe par équipe (depart_par_equipe, fin_par_equipe, adresse d'arrivée)."""

import time
from datetime import UTC, datetime, timedelta
from itertools import pairwise

import httpx
import pytest
from test_optimisation_ecoute import demande, equipe, sig
from test_optimisation_plan_partiel import MagasinPlan, cles, par_equipe

from optimisation import matrice_live
from optimisation.ecoute import (
    MESSAGE_DEPART_INCONNU,
    MESSAGE_FIN_INCONNUE,
    ErreurDemande,
    construire_donnees,
    traiter_demande,
)
from optimisation.gain import tournees_ordre_arrivee
from optimisation.modeles import Arret, Equipe, Lieu, Parametres, Probleme, fin_de_equipe
from optimisation.plan_partiel import details_de
from optimisation.solveur import resoudre
from scripts.charger_demo import lignes_equipes

# Une droite : 10 s et 100 m par unité.
X = {"G": 0, "A": 10, "B": 20, "C": 30, "D": 19, "R": -5, "Z": 40}
DEBUT = 1000


@pytest.fixture(autouse=True)
def memoire_vide():
    matrice_live.vider_memoire()
    yield
    matrice_live.vider_memoire()


def probleme(ids, arrets, equipes, fin="garage", fin_lieu=None):
    lieux = [Lieu(i, 45.5, -73.6 + X[i] * 0.001) for i in ids]
    temps = [[abs(X[a] - X[b]) * 10 for b in ids] for a in ids]
    dist = [[abs(X[a] - X[b]) * 100 for b in ids] for a in ids]
    return Probleme(
        lieux,
        temps,
        dist,
        arrets,
        equipes,
        parametres=Parametres(intervention_s=100, limite_s=1.0, fin=fin, fin_lieu=fin_lieu),
    )


def arrets_abc():
    return [Arret(i, "faible", ordre_arrivee=r) for r, i in enumerate("ABC")]


def long_quart(**kw):
    return {"fin_s": DEBUT + 100_000, "debut_s": DEBUT, **kw}


def parcours(t):
    lieux = t["lieux"]
    return sum(abs(X[a] - X[b]) * 100 for a, b in pairwise(lieux))


def test_deux_equipes_avec_des_departs_et_des_fins_differents():
    equipes = [
        Equipe("e1", "E1", "G", **long_quart(fin="libre")),
        Equipe(
            "e2", "E2", "G", **long_quart(depart="D", fin="arrivee", fin_lieu="R", fin_nom="Ma rue")
        ),
    ]
    p = probleme(["G", "A", "B", "C", "D", "R"], arrets_abc(), equipes)
    r = resoudre(p)
    t = {x["equipe_id"]: x for x in r["tournees"]}
    assert r["non_servis"] == []
    # Équipe 1 : part du garage, finit au dernier arrêt.
    assert t["e1"]["lieux"][0] == "G" and t["e1"]["lieux"][-1] in "ABC"
    assert (t["e1"]["depart"], t["e1"]["fin"], t["e1"]["fin_nom"]) == ("garage", "libre", None)
    # Équipe 2 : part de sa position D, finit à l'adresse d'arrivée R.
    assert t["e2"]["lieux"][0] == "D" and t["e2"]["lieux"][-1] == "R"
    assert (t["e2"]["depart"], t["e2"]["fin"], t["e2"]["fin_nom"]) == (
        "position",
        "arrivee",
        "Ma rue",
    )
    assert t["e2"]["fin_position"]["longitude"] == pytest.approx(-73.6 - 5 * 0.001)
    assert t["e2"]["depart_position"]["longitude"] == pytest.approx(-73.6 + 19 * 0.001)
    # Les distances comptent le premier trajet depuis le départ réel et le dernier jusqu'à la fin réelle.
    for tournee in t.values():
        assert tournee["distance_m"] == parcours(tournee)
        assert tournee["duree_s"] == tournee["trajet_s"] + 100 * len(tournee["arrets"])
    assert sum(len(x["arrets"]) for x in t.values()) == 3


def test_le_choix_de_l_equipe_l_emporte_sur_la_fin_globale():
    equipes = [
        Equipe("e1", "E1", "G", **long_quart(fin="garage")),
        Equipe("e2", "E2", "G", **long_quart()),
    ]
    p = probleme(["G", "A", "B", "C"], arrets_abc(), equipes, fin="libre")
    assert [fin_de_equipe(p.parametres, e) for e in equipes] == [("garage", "G"), ("libre", None)]
    r = resoudre(p)
    t = {x["equipe_id"]: x for x in r["tournees"]}
    assert t["e1"]["fin"] == "garage" and (not t["e1"]["arrets"] or t["e1"]["lieux"][-1] == "G")
    assert t["e2"]["fin"] == "libre" and t["e2"]["lieux"][-1] != "G"


def test_defaut_identique_sans_choix_par_equipe():
    ids = ["G", "A", "B", "C"]
    sans = [Equipe("e1", "E1", "G", **long_quart())]
    avec = [
        Equipe("e1", "E1", "G", **long_quart(depart=None, fin=None, fin_lieu=None, fin_nom=None))
    ]
    a, b = resoudre(probleme(ids, arrets_abc(), sans)), resoudre(probleme(ids, arrets_abc(), avec))
    assert a["tournees"] == b["tournees"] and a["gain"] == b["gain"]
    assert a["tournees"][0]["lieux"] == ["G", "A", "B", "C", "G"]
    assert a["tournees"][0]["fin"] == "garage"


def test_reference_ordre_d_arrivee_suit_le_depart_et_la_fin_de_chaque_equipe():
    equipes = [
        Equipe("e1", "E1", "G", **long_quart(fin="libre")),
        Equipe("e2", "E2", "G", **long_quart(depart="D", fin="arrivee", fin_lieu="R")),
    ]
    p = probleme(["G", "A", "B", "C", "D", "R"], arrets_abc(), equipes)
    ref = tournees_ordre_arrivee(p, avec_limite=False)
    par = {t["equipe_id"]: t for t in ref["tournees"]}
    # Chaque arrêt va à l'équipe qui l'atteint le plus tôt, du plus ancien au plus récent :
    # A : e2 (depuis D, 9 unités) devant e1 (depuis G, 10) ; B : e1 (20 unités, arrivée à 1 200 s) devant
    # e2 (depuis A après 100 s de service, arrivée à 1 290 s) ; C : e2 (depuis A, 1 390 s) devant e1 (1 400 s).
    assert par["e2"]["arrets"] == ["A", "C"] and par["e1"]["arrets"] == ["B"]
    # e2 part de D (19), passe A (10), C (30), finit en R (-5) ; e1 part du garage, finit en B (fin libre).
    assert par["e2"]["distance_m"] == (9 + 20 + 35) * 100
    assert par["e1"]["distance_m"] == 20 * 100


def test_fin_d_equipe_inconnue_ou_sans_lieu_refusee():
    e = Equipe("e1", "E1", "G", **long_quart(fin="ailleurs"))
    with pytest.raises(ValueError, match="Fin inconnue pour l'équipe"):
        resoudre(probleme(["G", "A"], [Arret("A", "faible")], [e]))
    e = Equipe("e1", "E1", "G", **long_quart(fin="arrivee", fin_lieu="Q"))
    with pytest.raises(ValueError, match="lieu d'arrivée connu"):
        resoudre(probleme(["G", "A"], [Arret("A", "faible")], [e]))
    e = Equipe("e1", "E1", "G", **long_quart(fin="arrivee", fin_lieu="A"))
    with pytest.raises(ValueError, match="lieu de départ ou de fin"):
        resoudre(probleme(["G", "A"], [Arret("A", "faible")], [e]))


# ---------- la demande : depart_par_equipe, fin_par_equipe, adresse d'arrivée ----------

MAINTENANT = datetime(2026, 11, 22, 11, 0, tzinfo=UTC)


def position(equipe_id, age_s=60, lat=45.502, lng=-73.561):
    return {
        "equipe_id": equipe_id,
        "latitude": lat,
        "longitude": lng,
        "maj_le": (MAINTENANT - timedelta(seconds=age_s)).isoformat(),
    }


def ligne_equipe(i, **extra):
    return {**equipe(i, 45.51, -73.57), **extra}


def sigs():
    return [
        sig("s1", lat=45.5, lng=-73.56, grille="g1"),
        sig("s2", lat=45.505, lng=-73.565, grille="g2"),
    ]


def donnees(params, equipes, positions=None, client=None):
    return construire_donnees(
        {"date": "2026-11-22", **params},
        equipes,
        [],
        sigs(),
        None,
        MAINTENANT,
        positions=positions,
        client_osrm=client,
    )[0]


def test_depart_par_equipe_l_emporte_sur_le_depart_global():
    equipes = [ligne_equipe("e1"), ligne_equipe("e2")]
    pos = [position("e1"), position("e2")]
    d = donnees({"depart": "position", "depart_par_equipe": {"e2": "garage"}}, equipes, pos)
    assert {e.id: e.depart for e in d.probleme.equipes} == {"e1": "depart:e1", "e2": None}
    d = donnees({"depart": "garage", "depart_par_equipe": {"e2": "position"}}, equipes, pos)
    assert {e.id: e.depart for e in d.probleme.equipes} == {"e1": None, "e2": "depart:e2"}
    # Une position périmée : le garage, équipe par équipe.
    d = donnees(
        {"depart_par_equipe": {"e1": "position", "e2": "position"}},
        equipes,
        [position("e1"), position("e2", age_s=3600)],
    )
    assert {e.id: e.depart for e in d.probleme.equipes} == {"e1": "depart:e1", "e2": None}


def test_adresse_d_arrivee_par_equipe_et_absente_donne_le_garage():
    equipes = [
        ligne_equipe(
            "e1",
            arrivee_latitude=45.52,
            arrivee_longitude=-73.58,
            arrivee_nom="Dépôt Est",
            arrivee_adresse="1 rue A",
        ),
        ligne_equipe("e2", arrivee_latitude=None, arrivee_longitude=None, arrivee_nom=None),
        ligne_equipe("e3"),  # colonnes absentes : migration 0007 non lancée
    ]
    d = donnees({"fin_par_equipe": {"e1": "arrivee", "e2": "arrivee", "e3": "arrivee"}}, equipes)
    p = d.probleme
    e1, e2, e3 = p.equipes
    assert (e1.fin, e1.fin_lieu, e1.fin_nom) == ("arrivee", "arrivee:e1", "Dépôt Est")
    lieu = next(x for x in p.lieux if x.id == "arrivee:e1")
    assert (lieu.latitude, lieu.longitude) == (45.52, -73.58)
    assert e2.fin == "garage" and e2.fin_lieu is None and e3.fin == "garage"
    assert not any(x.id.startswith("arrivee:e2") or x.id.startswith("arrivee:e3") for x in p.lieux)
    r = resoudre(p)
    t = {x["equipe_id"]: x for x in r["tournees"]}
    assert t["e1"]["fin"] == "arrivee" and t["e1"]["fin_nom"] == "Dépôt Est"
    assert t["e1"]["fin_position"] == {"latitude": 45.52, "longitude": -73.58}
    assert t["e2"]["fin"] == "garage" and t["e3"]["fin"] == "garage"


def test_nom_d_arrivee_par_defaut_l_adresse_et_libre_par_equipe():
    equipes = [
        ligne_equipe(
            "e1", arrivee_latitude=45.52, arrivee_longitude=-73.58, arrivee_adresse="1 rue A"
        ),
        ligne_equipe("e2"),
    ]
    p = donnees({"fin_par_equipe": {"e1": "arrivee", "e2": "libre"}}, equipes).probleme
    assert p.equipes[0].fin_nom == "1 rue A" and p.equipes[1].fin == "libre"


def test_adresse_d_arrivee_non_demandee_reste_au_garage():
    equipes = [ligne_equipe("e1", arrivee_latitude=45.52, arrivee_longitude=-73.58)]
    p = donnees({}, equipes).probleme
    assert p.equipes[0].fin is None and not any(x.id.startswith("arrivee:") for x in p.lieux)
    assert resoudre(p)["tournees"][0]["fin"] == "garage"


def test_valeurs_inconnues_refusees():
    equipes = [ligne_equipe("e1")]
    with pytest.raises(ErreurDemande, match=MESSAGE_DEPART_INCONNU):
        donnees({"depart_par_equipe": {"e1": "ailleurs"}}, equipes)
    with pytest.raises(ErreurDemande, match=MESSAGE_FIN_INCONNUE):
        donnees({"fin_par_equipe": {"e1": "ailleurs"}}, equipes)
    with pytest.raises(ErreurDemande, match=MESSAGE_DEPART_INCONNU):
        donnees({"depart": "ailleurs"}, equipes)


def test_l_adresse_d_arrivee_passe_par_la_completion_osrm():
    requetes: list[str] = []

    def gestionnaire(requete: httpx.Request) -> httpx.Response:
        requetes.append(requete.url.path)
        coords = requete.url.path.rsplit("/", 1)[-1].split(";")
        k = len(coords)
        m = [[0 if a == b else 7.0 for b in range(k)] for a in range(k)]
        return httpx.Response(200, json={"code": "Ok", "durations": m, "distances": m})

    client = httpx.Client(transport=httpx.MockTransport(gestionnaire))
    equipes = [ligne_equipe("e1", arrivee_latitude=45.52, arrivee_longitude=-73.58)]
    d = donnees({"fin_par_equipe": {"e1": "arrivee"}}, equipes, client=client)
    assert requetes and "-73.580000,45.520000" in requetes[0]
    p = d.probleme
    arrivee = next(i for i, x in enumerate(p.lieux) if x.id == "arrivee:e1")
    assert all(p.temps_s[i][arrivee] == 7 for i in range(len(p.lieux)) if i != arrivee)


def test_demande_complete_deux_equipes_choix_differents_et_details():
    def lancer(**params):
        m = MagasinPlan(
            demandes=[demande("d1", **params)],
            equipes=[
                ligne_equipe(
                    "e1", garage_latitude=45.50, garage_longitude=-73.58, fin_quart="08:55:00"
                ),
                ligne_equipe(
                    "e2",
                    fin_quart="08:55:00",
                    arrivee_latitude=45.52,
                    arrivee_longitude=-73.58,
                    arrivee_nom="Dépôt Est",
                ),
            ],
            signalements=[
                sig(f"s{i}", lat=45.50 + 0.001 * i, lng=-73.57, grille=f"g{i}") for i in range(8)
            ],
        )
        traiter_demande(m, m.demandes["d1"], None, utiliser_osrm=False, journal=lambda *_: None)
        return m

    m = lancer(
        depart_par_equipe={"e1": "garage", "e2": "garage"},
        fin_par_equipe={"e1": "libre", "e2": "arrivee"},
    )
    t = par_equipe(m.tournees["d1"])
    assert t["e1"]["fin"] == "libre" and t["e2"]["fin"] == "arrivee"
    assert t["e2"]["fin_nom"] == "Dépôt Est"
    assert details_de(t["e2"])["fin_nom"] == "Dépôt Est"
    assert "fin_nom" not in details_de(t["e1"])
    base = {x["equipe_id"]: x for x in m.en_place}
    assert (
        base["e2"]["details"]["fin"] == "arrivee"
        and base["e2"]["details"]["fin_nom"] == "Dépôt Est"
    )
    # Recalcul de la tournée de e2 sans fin demandée : elle garde son adresse d'arrivée.
    m.demandes["d2"] = demande(
        "d2", cree="2026-11-22T08:00:00Z", equipe_ids=["e2"], recalcul="tournee"
    )
    traiter_demande(m, m.demandes["d2"], None, utiliser_osrm=False, journal=lambda *_: None)
    t2 = par_equipe(m.tournees["d2"])
    assert t2["e2"]["fin"] == "arrivee" and t2["e2"]["fin_nom"] == "Dépôt Est"
    assert t2["e2"]["fin_position"] == {"latitude": 45.52, "longitude": -73.58}
    assert t2["e1"]["conservee"] is True and t2["e1"]["fin"] == "libre"
    assert cles(t2["e1"]) == cles(t["e1"])


def test_demande_sans_choix_par_equipe_inchangee():
    m = MagasinPlan(
        demandes=[demande("d1")],
        equipes=[
            ligne_equipe("e1", arrivee_latitude=45.52, arrivee_longitude=-73.58, arrivee_nom="X")
        ],
        signalements=[sig("s1", lat=45.5, lng=-73.56, grille="g1")],
    )
    traiter_demande(m, m.demandes["d1"], None, utiliser_osrm=False, journal=lambda *_: None)
    t = m.tournees["d1"]["tournees"][0]
    assert t["depart"] == "garage" and t["fin"] == "garage" and t["fin_nom"] is None
    assert t["depart_position"] == t["fin_position"]


def test_charger_demo_ne_touche_pas_aux_nouvelles_colonnes(charger):
    lignes = lignes_equipes(charger("equipes-demo.json"))
    interdites = {
        "garage_adresse",
        "arrivee_nom",
        "arrivee_adresse",
        "arrivee_latitude",
        "arrivee_longitude",
    }
    assert lignes and not interdites & set(lignes[0])


def test_la_sortie_reste_sans_arrivee_quand_aucune_adresse(tmp_path):
    del tmp_path
    p = probleme(["G", "A"], [Arret("A", "faible")], [Equipe("e1", "E1", "G", **long_quart())])
    t = resoudre(p)["tournees"][0]
    assert t["fin"] == "garage" and t["fin_nom"] is None
    assert time.monotonic() > 0
