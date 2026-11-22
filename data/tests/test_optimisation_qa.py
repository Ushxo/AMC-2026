"""Cas de contrôle du solveur, à réponse connue (écrits à la main, sans reprendre les helpers du code)."""

import itertools
import random
import time

import pytest

from optimisation.modeles import Arret, Equipe, Incident, Lieu, Parametres, Probleme
from optimisation.solveur import resoudre


def lieux_de(ids):
    return [Lieu(i, 45.5, -73.6 + k * 1e-4) for k, i in enumerate(ids)]


def probleme(ids, temps, arrets, equipes, distance=None, interv=0, limite=1.0, **kw):
    return Probleme(
        lieux=lieux_de(ids),
        temps_s=temps,
        distance_m=distance if distance is not None else temps,
        arrets=arrets,
        equipes=equipes,
        parametres=Parametres(intervention_s=interv, limite_s=limite),
        **kw,
    )


def droite(pos):
    ids = list(pos)
    return ids, [[abs(pos[a] - pos[b]) for b in ids] for a in ids]


def suite(res, i=0):
    return [a["arret_id"] for a in res["tournees"][i]["arrets"]]


def test_ordre_optimal_et_gain_calcule_a_la_main():
    ids, t = droite({"G": 0, "A": 10, "B": 20, "C": 30})
    arrets = [
        Arret("C", "faible", ordre_arrivee=0),
        Arret("A", "faible", ordre_arrivee=1),
        Arret("B", "faible", ordre_arrivee=2),
    ]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=1000)]))
    assert suite(r) in (["A", "B", "C"], ["C", "B", "A"])
    assert r["tournees"][0]["retour_s"] == 60
    # Ordre d'arrivée C, A, B : 30 + 20 + 10 + 20 = 80.
    assert r["gain"]["ordre_arrivee"]["duree_s"] == 80
    assert r["gain"]["duree_gagnee_s"] == 20
    assert r["gain"]["distance_gagnee_m"] == 20
    assert r["gain"]["memes_arrets_servis"] is True


def test_oracle_force_brute_matrice_non_symetrique():
    rnd = random.Random(7)
    ids = ["G", "A", "B", "C", "D", "E"]
    n = len(ids)
    t = [[0 if i == j else rnd.randint(5, 60) for j in range(n)] for i in range(n)]
    arrets = [Arret(i, "faible", ordre_arrivee=k) for k, i in enumerate(ids[1:])]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=10_000)], limite=2.0))
    meilleur = min(
        t[0][p[0]] + sum(t[a][b] for a, b in itertools.pairwise(p)) + t[p[-1]][0]
        for p in itertools.permutations(range(1, n))
    )
    assert r["non_servis"] == []
    assert r["tournees"][0]["retour_s"] == meilleur


def test_asymetrie_le_sens_le_moins_cher_est_choisi():
    ids = ["G", "A", "B"]
    t = [[0, 10, 100], [100, 0, 10], [10, 100, 0]]  # G>A>B>G coûte 30, l'inverse 300
    arrets = [Arret("A", "faible"), Arret("B", "faible")]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=1000)]))
    assert suite(r) == ["A", "B"]
    assert r["tournees"][0]["retour_s"] == 30


def test_deux_equipes_deux_garages():
    ids, t = droite({"G1": 0, "a1": 5, "a2": 10, "G2": 100, "b1": 95, "b2": 90})
    arrets = [Arret(i, "faible") for i in ("a1", "a2", "b1", "b2")]
    eq = [Equipe("e1", "E1", "G1", fin_s=1000), Equipe("e2", "E2", "G2", fin_s=1000)]
    r = resoudre(probleme(ids, t, arrets, eq))
    assert set(suite(r, 0)) == {"a1", "a2"}
    assert set(suite(r, 1)) == {"b1", "b2"}
    assert [x["retour_s"] for x in r["tournees"]] == [20, 20]


@pytest.mark.parametrize("grave", ["X", "Y"])
def test_quart_trop_court_le_grave_passe_avant_le_faible(grave):
    # Chaque aller-retour fait 80 s + 50 s d'intervention : un seul arrêt tient dans 140 s.
    ids, t = droite({"G": 0, "X": 40, "Y": -40})
    autre = "Y" if grave == "X" else "X"
    arrets = [Arret(autre, "faible", ordre_arrivee=0), Arret(grave, "elevee", ordre_arrivee=1)]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=140)], interv=50))
    assert suite(r) == [grave]
    assert r["non_servis"] == [autre]
    assert r["tournees"][0]["retour_s"] <= 140


def test_penalite_de_chantier_change_l_ordre():
    ids = ["G", "A", "B", "C"]
    base = [[0, 10, 10, 10], [10, 0, 1, 1], [10, 1, 0, 100], [10, 1, 100, 0]]
    arrets = [Arret(i, "faible") for i in "ABC"]
    eq = [Equipe("e", "E", "G", fin_s=10_000)]
    sans = resoudre(probleme(ids, base, arrets, eq))
    assert sans["tournees"][0]["retour_s"] == 22
    pen = [[0] * 4 for _ in range(4)]
    pen[1][2] = pen[2][1] = 1000  # chantier entre A et B
    avec = resoudre(probleme(ids, base, arrets, eq, penalites_s=pen))
    ordre = suite(avec)
    assert abs(ordre.index("A") - ordre.index("B")) != 1  # A et B ne se suivent plus
    assert avec["tournees"][0]["retour_s"] == 121


def test_incident_simule_penalise_le_trajet_qui_le_traverse():
    ids, t = droite({"G": 0, "A": 10, "B": 20})
    inc = [Incident(latitude=45.5, longitude=-73.6 + 1 * 1e-4 * 1.5, rayon_m=1, penalite_s=500)]
    p = probleme(
        ids,
        t,
        [Arret("A", "faible"), Arret("B", "faible")],
        [Equipe("e", "E", "G", fin_s=100_000)],
        incidents=inc,
    )
    r = resoudre(p)
    assert r["statut"] == "ok"
    assert r["non_servis"] == []


def test_zero_arret():
    ids, t = droite({"G": 0})
    r = resoudre(probleme(ids, t, [], [Equipe("e", "E", "G", fin_s=1000)]))
    assert r["statut"] == "ok"
    assert r["non_servis"] == []
    assert r["tournees"][0]["arrets"] == []


def test_une_equipe_sans_arret():
    ids, t = droite({"G": 0, "A": 10})
    eq = [Equipe("e1", "E1", "G", fin_s=1000), Equipe("e2", "E2", "G", fin_s=1000)]
    r = resoudre(probleme(ids, t, [Arret("A", "faible")], eq))
    nombres = sorted(len(x["arrets"]) for x in r["tournees"])
    assert nombres == [0, 1]
    vide = next(x for x in r["tournees"] if not x["arrets"])
    assert vide["duree_s"] == 0 and vide["distance_m"] == 0


def test_changement_du_nombre_d_equipes():
    ids, t = droite({"G": 0, "a": 10, "b": 20, "c": -10, "d": -20})
    arrets = [Arret(i, "faible") for i in "abcd"]
    une = resoudre(probleme(ids, t, arrets, [Equipe("e1", "E1", "G", fin_s=50)]))
    assert une["non_servis"]  # 80 s sont nécessaires, le quart en a 50
    deux = resoudre(
        probleme(
            ids, t, arrets, [Equipe("e1", "E1", "G", fin_s=50), Equipe("e2", "E2", "G", fin_s=50)]
        )
    )
    assert deux["non_servis"] == []
    assert deux["gain"]["arrets_en_plus"] >= 0


def verifier_heures(p, r):
    fins = {e.id: e for e in p.equipes}
    service = {
        a.id: a.intervention_s if a.intervention_s is not None else p.parametres.intervention_s
        for a in p.arrets
    }
    for tr in r["tournees"]:
        e = fins[tr["equipe_id"]]
        prec = e.debut_s
        for a in tr["arrets"]:
            assert a["arrivee_s"] >= prec
            assert a["depart_s"] - a["arrivee_s"] == service[a["arret_id"]]
            prec = a["depart_s"]
        assert tr["retour_s"] >= prec
        assert tr["retour_s"] <= e.fin_s


def test_heures_respectent_quart_et_intervention():
    ids, t = droite({"G": 0, "A": 10, "B": 20, "C": 30})
    arrets = [Arret(i, "moyenne") for i in "ABC"]
    p = probleme(ids, t, arrets, [Equipe("e", "E", "G", debut_s=300, fin_s=1300)], interv=600)
    r = resoudre(p)
    verifier_heures(p, r)
    assert all(a["arrivee_s"] >= 300 for a in r["tournees"][0]["arrets"])


def test_gain_distance_recalculee_et_memes_arrets():
    ids, t = droite({"G": 0, "A": 10, "B": 20, "C": 30})
    arrets = [
        Arret("C", "faible", ordre_arrivee=0),
        Arret("A", "faible", ordre_arrivee=1),
        Arret("B", "faible", ordre_arrivee=2),
    ]
    p = probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=1000)])
    r = resoudre(p)
    chemin = r["tournees"][0]["lieux"]
    index = {l.id: i for i, l in enumerate(p.lieux)}
    d = sum(p.distance_m[index[a]][index[b]] for a, b in itertools.pairwise(chemin))
    assert r["tournees"][0]["distance_m"] == d


def test_gain_signale_des_arrets_differents_meme_si_le_nombre_est_egal():
    # Le quart ne permet qu'un arrêt. L'ordre d'arrivée sert le faible (le plus ancien), le solveur
    # sert l'élevé : le nombre est égal (1 et 1) mais ce ne sont pas les mêmes arrêts.
    ids, t = droite({"G": 0, "X": 40, "Y": -40})
    arrets = [Arret("X", "faible", ordre_arrivee=0), Arret("Y", "elevee", ordre_arrivee=1)]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=140)], interv=50))
    assert suite(r) == ["Y"]
    assert r["gain"]["memes_arrets_servis"] is False
    # La référence « à travail égal » sert les mêmes arrêts que l'optimisé (ici Y), sans limite de quart.
    assert r["gain"]["ordre_arrivee"]["arrets_servis"] == r["gain"]["optimise"]["arrets_servis"] == 1
    assert r["gain"]["dans_le_quart"] == {"ordre_arrivee": 1, "optimise": 1, "arrets_en_plus": 0}


def test_190_arrets_4_equipes_sous_la_limite():
    rnd = random.Random(42)
    n_arrets, garages = 190, ["G1", "G2", "G3", "G4"]
    ids = garages + [f"s{k}" for k in range(n_arrets)]
    pts = [(rnd.uniform(0, 8000), rnd.uniform(0, 8000)) for _ in ids]
    t = [[int(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 / 8) for b in pts] for a in pts]
    d = [[int(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5) for b in pts] for a in pts]
    grav = ["faible", "moyenne", "elevee"]
    arrets = [Arret(f"s{k}", grav[k % 3], ordre_arrivee=k) for k in range(n_arrets)]
    eq = [Equipe(f"e{k}", f"E{k}", garages[k], fin_s=8 * 3600) for k in range(4)]
    p = Probleme(
        lieux=lieux_de(ids),
        temps_s=t,
        distance_m=d,
        arrets=arrets,
        equipes=eq,
        parametres=Parametres(intervention_s=600, limite_s=8.0),
    )
    debut = time.monotonic()
    r = resoudre(p)
    mur = time.monotonic() - debut
    assert r["statut"] == "ok"
    assert mur < 12  # limite de 8 s plus la lecture du problème
    verifier_heures(p, r)
    servis = {a["arret_id"] for tr in r["tournees"] for a in tr["arrets"]}
    assert servis.isdisjoint(r["non_servis"])
    assert servis | set(r["non_servis"]) == {a.id for a in arrets}
    assert len(servis) == sum(len(tr["arrets"]) for tr in r["tournees"])  # aucun arrêt en double


def test_lieu_inutilise_n_est_pas_une_visite_cachee():
    # Le lieu Z existe dans la matrice mais n'est pas un arrêt ni un garage : il ne doit pas être visité.
    ids, t = droite({"G": 0, "A": 10, "Z": 15, "B": 20})
    arrets = [Arret("A", "faible"), Arret("B", "faible")]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=1000)]))
    assert suite(r) in (["A", "B"], ["B", "A"])
    assert "Z" not in r["tournees"][0]["lieux"]
    assert r["tournees"][0]["retour_s"] == 40


def test_garage_inutilise_ne_change_ni_la_distance_ni_le_gain():
    ids, t = droite({"G": 0, "H": 500, "A": 10, "B": 20})
    arrets = [Arret("A", "faible", ordre_arrivee=1), Arret("B", "faible", ordre_arrivee=0)]
    r = resoudre(probleme(ids, t, arrets, [Equipe("e", "E", "G", fin_s=1000)]))
    assert r["tournees"][0]["distance_m"] == 40
    assert r["gain"]["optimise"]["distance_m"] == 40


@pytest.mark.parametrize("mauvais", ["temps", "penalite", "intervention", "poids"])
def test_valeurs_negatives_refusees(mauvais):
    ids, t = droite({"G": 0, "A": 10})
    pen = [[0, 0], [0, 0]]
    interv, poids = 0, {"faible": 10_000, "moyenne": 100_000, "elevee": 1_000_000}
    if mauvais == "temps":
        t = [[0, -5], [-5, 0]]
    elif mauvais == "penalite":
        pen = [[0, -1], [0, 0]]
    elif mauvais == "intervention":
        interv = -1
    else:
        poids["faible"] = -1
    p = probleme(ids, t, [Arret("A", "faible")], [Equipe("e", "E", "G", fin_s=1000)],
                 interv=interv, penalites_s=pen)
    p = Probleme(**{**p.__dict__, "parametres": Parametres(intervention_s=interv, limite_s=1.0,
                                                           penalite_non_visite=poids)})
    with pytest.raises(ValueError):
        resoudre(p)
