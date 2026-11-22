import json
import random
import time

import pytest

from optimisation.incident import penalites_incident
from optimisation.modeles import Arret, Equipe, Incident, Lieu, Parametres, Probleme
from optimisation.solveur import resoudre

# Monde jouet : des lieux sur une droite, le temps de trajet vaut la distance (1 s par unité).


def droite(positions: dict[str, float]):
    ids = list(positions)
    lieux = [Lieu(i, 45.5, -73.6 + positions[i] * 1e-5) for i in ids]
    m = [[int(abs(positions[a] - positions[b])) for b in ids] for a in ids]
    return lieux, m, [row[:] for row in m]


def probleme(positions, arrets, equipes, **kw):
    lieux, temps, dist = droite(positions)
    params = kw.pop("parametres", Parametres(intervention_s=10, limite_s=0.3))
    return Probleme(
        lieux=lieux,
        temps_s=temps,
        distance_m=dist,
        arrets=arrets,
        equipes=equipes,
        parametres=params,
        **kw,
    )


def ids_tournee(res, i=0):
    return [a["arret_id"] for a in res["tournees"][i]["arrets"]]


def test_une_equipe_trois_arrets_ordre_optimal():
    p = probleme(
        {"G": 0, "A": 10, "B": 20, "C": 30},
        [
            Arret("C", "faible", ordre_arrivee=0),
            Arret("A", "faible", ordre_arrivee=1),
            Arret("B", "faible", ordre_arrivee=2),
        ],
        [Equipe("e1", "Équipe 1", "G", fin_s=10_000)],
    )
    r = resoudre(p)
    assert ids_tournee(r) == ["A", "B", "C"]
    assert r["tournees"][0]["distance_m"] == 60  # aller 30, retour 30
    assert r["non_servis"] == []
    assert r["tournees"][0]["arrets"][0]["arrivee_s"] == 10
    assert r["tournees"][0]["arrets"][1]["arrivee_s"] == 30  # 10 + 10 d'intervention + 10 de trajet


def test_deux_equipes_deux_grappes():
    p = probleme(
        {"G1": 0, "A1": 5, "A2": 8, "G2": 100, "B1": 95, "B2": 92},
        [Arret(i, "faible") for i in ("A1", "A2", "B1", "B2")],
        [Equipe("e1", "E1", "G1", fin_s=10_000), Equipe("e2", "E2", "G2", fin_s=10_000)],
    )
    r = resoudre(p)
    assert set(ids_tournee(r, 0)) == {"A1", "A2"}
    assert set(ids_tournee(r, 1)) == {"B1", "B2"}


def test_quart_trop_court_l_arret_grave_passe_avant_le_faible():
    # Un seul arrêt tient dans le quart. Le grave est plus loin, il doit quand même être choisi.
    p = probleme(
        {"G": 0, "PROCHE": 10, "LOIN": 40},
        [Arret("PROCHE", "faible"), Arret("LOIN", "elevee")],
        [Equipe("e1", "E1", "G", fin_s=95)],  # LOIN seul : 90 ; avec PROCHE : 100
    )
    r = resoudre(p)
    assert ids_tournee(r) == ["LOIN"]
    assert r["non_servis"] == ["PROCHE"]


def test_penalite_de_chantier_change_l_ordre():
    ids = ["G", "A", "B"]
    temps = [[0, 9, 12], [12, 0, 10], [11, 10, 0]]
    lieux = [Lieu(i) for i in ids]
    arrets = [Arret("A", "faible"), Arret("B", "faible")]
    equipes = [Equipe("e1", "E1", "G", fin_s=10_000)]
    params = Parametres(intervention_s=0, limite_s=0.3)
    sans = Probleme(lieux, temps, temps, arrets, equipes, parametres=params)
    assert ids_tournee(resoudre(sans)) == ["A", "B"]  # 9 + 10 + 11 = 30
    pen = [[0, 0, 0], [0, 0, 100], [0, 0, 0]]  # chantier sur le trajet A -> B
    avec = Probleme(lieux, temps, temps, arrets, equipes, penalites_s=pen, parametres=params)
    assert ids_tournee(resoudre(avec)) == ["B", "A"]  # 12 + 10 + 12 = 34 < 130


def test_penalites_incident_seulement_sur_les_trajets_qui_passent_dans_le_rayon():
    lieux = [Lieu("O", 45.5, -73.60), Lieu("E", 45.5, -73.58), Lieu("N", 45.52, -73.60)]
    inc = Incident(latitude=45.5, longitude=-73.59, rayon_m=100, penalite_s=500)
    pen = penalites_incident(lieux, [inc])
    assert pen[0][1] == 500 and pen[1][0] == 500  # O <-> E passe par l'incident
    assert pen[0][2] == 0  # O <-> N : le long de la rue vers le nord
    assert pen[0][0] == 0


def test_incident_reoptimise_le_trajet():
    # Même monde sur une droite : l'incident au milieu pénalise A <-> B, l'équipe contourne en ordre inverse.
    lieux = [Lieu("G", 45.5, -73.600), Lieu("A", 45.5, -73.590), Lieu("B", 45.5, -73.570)]
    temps = [[0, 9, 12], [12, 0, 10], [11, 10, 0]]
    arrets = [Arret("A", "faible"), Arret("B", "faible")]
    equipes = [Equipe("e1", "E1", "G", fin_s=10_000)]
    params = Parametres(intervention_s=0, limite_s=0.3)
    base = Probleme(lieux, temps, temps, arrets, equipes, parametres=params)
    r0 = resoudre(base)
    inc = Incident(45.5, -73.580, 50, 1000)  # entre A et B
    r1 = resoudre(
        Probleme(
            lieux,
            temps,
            temps,
            arrets,
            equipes,
            incidents=[inc],
            parametres=params,
            tournees_initiales={"e1": ids_tournee(r0)},
        )
    )
    assert ids_tournee(r0) == ["A", "B"]
    assert ids_tournee(r1) in (["A", "B"], ["B", "A"])
    # Les deux ordres traversent A <-> B une fois : l'incident ne peut pas être évité, les deux sont servis.
    assert r1["non_servis"] == []


def test_gain_contre_l_ordre_d_arrivee():
    # Les signalements arrivent en zigzag ; l'ordre optimal est une droite.
    p = probleme(
        {"G": 0, "A": 10, "B": 20, "C": 30, "D": 40},
        [
            Arret("D", "faible", ordre_arrivee=0),
            Arret("A", "faible", ordre_arrivee=1),
            Arret("C", "faible", ordre_arrivee=2),
            Arret("B", "faible", ordre_arrivee=3),
        ],
        [Equipe("e1", "E1", "G", fin_s=100_000)],
    )
    g = resoudre(p)["gain"]
    assert g["memes_arrets_servis"] is True
    assert g["optimise"]["distance_m"] == 80
    assert g["ordre_arrivee"]["distance_m"] > 80
    assert g["distance_gagnee_m"] == g["ordre_arrivee"]["distance_m"] - 80
    assert g["duree_gagnee_s"] > 0


def test_resultat_serialisable_en_json_et_depuis_dict():
    d = {
        "lieux": [{"id": "G"}, {"id": "A"}],
        "temps_s": [[0, 5], [5, 0]],
        "distance_m": [[0, 50], [50, 0]],
        "arrets": [{"id": "A", "gravite": "moyenne"}],
        "equipes": [{"id": "e1", "nom": "E1", "garage": "G", "fin_s": 1000}],
        "parametres": {"intervention_s": 20, "limite_s": 0.3},
    }
    r = resoudre(Probleme.depuis_dict(d))
    assert json.loads(json.dumps(r))["tournees"][0]["arrets"][0]["arret_id"] == "A"


def test_entrees_invalides():
    base = {"positions": {"G": 0, "A": 1}, "equipes": [Equipe("e", "E", "G", fin_s=100)]}
    with pytest.raises(ValueError):
        resoudre(probleme(arrets=[Arret("A", "tres_grave")], **base))
    with pytest.raises(ValueError):
        resoudre(probleme(arrets=[Arret("G", "faible")], **base))  # un garage n'est pas un arrêt
    with pytest.raises(ValueError):
        resoudre(probleme(arrets=[Arret("Z", "faible")], **base))
    with pytest.raises(ValueError):
        resoudre(
            probleme(arrets=[], positions={"G": 0}, equipes=[Equipe("e", "E", "X", fin_s=100)])
        )
    with pytest.raises(ValueError):
        resoudre(
            probleme(
                arrets=[Arret("A", "faible")],
                positions=base["positions"],
                equipes=[Equipe("e", "E", "G", fin_s=0)],
            )
        )
    lieux, _t, d = droite({"G": 0, "A": 1})
    with pytest.raises(ValueError):
        resoudre(
            Probleme(lieux, [[0]], d, [Arret("A", "faible")], [Equipe("e", "E", "G", fin_s=10)])
        )


def test_limite_de_temps_respectee_sur_un_probleme_moyen():
    rnd = random.Random(7)
    positions = {"G1": 0, "G2": 500}
    arrets = []
    for k in range(60):
        positions[f"S{k}"] = rnd.randint(1, 499)
        arrets.append(Arret(f"S{k}", rnd.choice(["faible", "moyenne", "elevee"]), ordre_arrivee=k))
    p = probleme(
        positions,
        arrets,
        [Equipe("e1", "E1", "G1", fin_s=3000), Equipe("e2", "E2", "G2", fin_s=3000)],
        parametres=Parametres(intervention_s=10, limite_s=2),
    )
    t0 = time.monotonic()
    r = resoudre(p)
    assert time.monotonic() - t0 < 6
    assert r["statut"] == "ok"
    servis = sum(len(t["arrets"]) for t in r["tournees"])
    assert servis + len(r["non_servis"]) == 60
    for t in r["tournees"]:
        assert t["retour_s"] <= 3000


def test_aucun_arret_donne_des_tournees_vides():
    p = probleme({"G": 0}, [], [Equipe("e", "E", "G", fin_s=100)])
    r = resoudre(p)
    assert r["tournees"][0]["arrets"] == []
    assert r["non_servis"] == []


def test_gain_a_travail_egal_depassement_du_quart_et_arrets_dans_le_quart():
    # Un quart trop court pour tout servir : l'optimisé sert A, B et C (90 s) ; la référence sert les
    # mêmes arrêts sans limite (C, A, B : 110 s, donc 10 s de dépassement) ; dans le quart, elle n'en sert que 2.
    p = probleme(
        {"G": 0, "A": 10, "B": 20, "C": 30, "D": 40},
        [
            Arret("C", "faible", ordre_arrivee=0),
            Arret("A", "faible", ordre_arrivee=1),
            Arret("B", "faible", ordre_arrivee=2),
            Arret("D", "faible", ordre_arrivee=3),
        ],
        [Equipe("e1", "E1", "G", fin_s=100)],
    )
    g = resoudre(p)["gain"]
    assert g["optimise"]["arrets_servis"] == 3 and g["ordre_arrivee"]["arrets_servis"] == 3
    # Dans le quart, l'ordre d'arrivée ne sert pas les mêmes arrêts : ensembles différents.
    assert g["memes_arrets_servis"] is False
    assert g["ordre_arrivee"]["depassement_quart_s"] == 10
    assert g["ordre_arrivee"]["distance_m"] == 80 and g["optimise"]["distance_m"] == 60
    assert g["distance_gagnee_m"] == 20
    assert g["dans_le_quart"] == {"ordre_arrivee": 2, "optimise": 3, "arrets_en_plus": 1}


def test_les_points_non_retenus_ne_sont_jamais_visites():
    # X et Y sont dans la matrice mais ne sont pas des arrêts retenus : ils ne doivent pas apparaître,
    # et la distance est celle du plan réellement calculé.
    p = probleme(
        {"G": 0, "A": 10, "X": 500, "B": 20, "Y": -300},
        [Arret("A", "faible"), Arret("B", "faible")],
        [Equipe("e1", "E1", "G", fin_s=10_000)],
    )
    r = resoudre(p)
    assert ids_tournee(r) == ["A", "B"]
    assert "X" not in r["tournees"][0]["lieux"] and "Y" not in r["tournees"][0]["lieux"]
    assert r["tournees"][0]["distance_m"] == 40
    assert r["gain"]["optimise"]["distance_m"] == 40


def test_garage_inutilise_retire_avec_deux_equipes_sur_trois_garages():
    p = probleme(
        {"G1": 0, "G2": 100, "G3": 1000, "A": 10, "B": 95},
        [Arret("A", "faible"), Arret("B", "faible")],
        [Equipe("e1", "E1", "G1", fin_s=10_000), Equipe("e2", "E2", "G2", fin_s=10_000)],
    )
    r = resoudre(p)
    assert all("G3" not in t["lieux"] for t in r["tournees"])
    assert set(ids_tournee(r, 0)) == {"A"} and set(ids_tournee(r, 1)) == {"B"}


@pytest.mark.parametrize(
    "modif",
    [
        lambda p: p.temps_s[0].__setitem__(1, -1),
        lambda p: p.distance_m[1].__setitem__(0, -5),
    ],
)
def test_matrices_negatives_refusees(modif):
    p = probleme({"G": 0, "A": 10}, [Arret("A", "faible")], [Equipe("e", "E", "G", fin_s=1000)])
    modif(p)
    with pytest.raises(ValueError, match="négative"):
        resoudre(p)


def test_penalites_interventions_poids_et_incidents_negatifs_refuses():
    base = {"positions": {"G": 0, "A": 10}, "equipes": [Equipe("e", "E", "G", fin_s=1000)]}
    cas = [
        {"arrets": [Arret("A", "faible", intervention_s=-1)]},
        {
            "arrets": [Arret("A", "faible")],
            "parametres": Parametres(intervention_s=-5, limite_s=0.3),
        },
        {
            "arrets": [Arret("A", "faible")],
            "parametres": Parametres(penalite_non_visite={"faible": -1}, limite_s=0.3),
        },
        {"arrets": [Arret("A", "faible")], "parametres": Parametres(equilibrage=-1, limite_s=0.3)},
        {"arrets": [Arret("A", "faible")], "incidents": [Incident(45.5, -73.6, 100, -10)]},
        {"arrets": [Arret("A", "faible")], "penalites_s": [[0, -3], [0, 0]]},
    ]
    for kw in cas:
        with pytest.raises(ValueError):
            resoudre(probleme(positions=base["positions"], equipes=base["equipes"], **kw))
