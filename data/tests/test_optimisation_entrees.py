import json
from dataclasses import replace
from datetime import date

import httpx
import pytest

from optimisation.adaptateur import vers_resultat
from optimisation.entrees import (
    OUT,
    arrets_depuis_signalements,
    charger_donnees,
    charger_probleme,
    construire_equipes,
    heure_en_secondes,
)
from optimisation.geometrie import ajouter_geometries, geometrie_tournee
from optimisation.precalculer import precalculer
from optimisation.solveur import resoudre


def sig(grille, etat="nouveau", gravite="faible", cree="2026-11-20T10:00:00Z"):
    return {
        "id": f"sig-{grille}-{etat}-{gravite}-{cree}",
        "grille_id": grille,
        "etat": etat,
        "gravite": gravite,
        "cree_le": cree,
    }


def test_heure_en_secondes():
    assert heure_en_secondes("07:00") == 25200
    assert heure_en_secondes("14:30") == 52200


def test_arrets_un_par_endroit_gravite_max_ouverts_seulement_et_rang_d_arrivee():
    s = [
        sig("a", gravite="faible", cree="2026-11-20T12:00:00Z"),
        sig("a", gravite="elevee", cree="2026-11-20T13:00:00Z"),
        sig("a", etat="regle", gravite="elevee"),  # fermé : ignoré
        sig("b", cree="2026-11-20T09:00:00Z"),
        sig("c", etat="rejete"),
        {
            "grille_id": None,
            "etat": "nouveau",
            "gravite": "faible",
            "cree_le": "2026-11-20T09:00:00Z",
        },
    ]
    arrets = arrets_depuis_signalements(s)
    assert [a.id for a in arrets] == ["b", "a"]  # b est le plus ancien
    a = arrets[1]
    assert (a.gravite, a.nombre) == ("elevee", 2)
    assert [x.id for x in arrets_depuis_signalements(s, seuil=2)] == ["a"]
    assert [x.id for x in arrets_depuis_signalements(s, ids_connus={"b"})] == ["b"]


def test_equipes_nombre_variable():
    d = {
        "garages": [{"id": "g1"}, {"id": "g2"}],
        "equipes": [
            {
                "id": "e1",
                "nom": "E1",
                "garage_id": "g1",
                "debut_quart": "07:00",
                "fin_quart": "14:00",
            },
            {
                "id": "e2",
                "nom": "E2",
                "garage_id": "g2",
                "debut_quart": "07:00",
                "fin_quart": "14:00",
            },
        ],
    }
    assert len(construire_equipes(d)) == 2
    assert [e.id for e in construire_equipes(d, 1)] == ["e1"]
    plus = construire_equipes(d, 5)
    assert len(plus) == 5 and plus[4].garage == "g1" and plus[4].fin_s == 50400
    with pytest.raises(ValueError):
        construire_equipes(d, 0)


def ecrire_fixture(dossier, nb_equipes=2):
    pts = [
        {"id": "g1", "type": "garage", "latitude": 45.50, "longitude": -73.58},
        {"id": "A", "type": "arret", "latitude": 45.501, "longitude": -73.58},
        {"id": "B", "type": "arret", "latitude": 45.502, "longitude": -73.58},
    ]
    n = len(pts)
    t = [[0 if i == j else 60 * abs(i - j) for j in range(n)] for i in range(n)]
    d = [[0 if i == j else 100 * abs(i - j) for j in range(n)] for i in range(n)]
    (dossier / "matrice.json").write_text(
        json.dumps({"points": pts, "durees_s": t, "distances_m": d})
    )
    (dossier / "penalites.json").write_text(
        json.dumps(
            {
                "points": ["g1", "A", "B"],
                "penalites_s": [[0] * n] * n,
                "penalite_arret_s": {"B": 120},
            }
        )
    )
    equipes = [
        {
            "id": f"e{i}",
            "nom": f"E{i}",
            "garage_id": "g1",
            "debut_quart": "07:00",
            "fin_quart": "14:00",
        }
        for i in range(1, nb_equipes + 1)
    ]
    (dossier / "equipes-demo.json").write_text(
        json.dumps(
            {
                "duree_intervention_min": 8,
                "garages": [{"id": "g1", "latitude": 45.5, "longitude": -73.58}],
                "equipes": equipes,
            }
        )
    )
    (dossier / "signalements-demo.json").write_text(
        json.dumps([sig("A", gravite="elevee"), sig("B"), sig("INCONNU")])
    )


def test_charger_probleme_et_resoudre(tmp_path):
    ecrire_fixture(tmp_path)
    p = charger_probleme(tmp_path, limite_s=0.3)
    assert {a.id for a in p.arrets} == {"A", "B"}  # INCONNU n'est pas dans la matrice
    assert {a.id: a.intervention_s for a in p.arrets} == {
        "A": 480,
        "B": 600,
    }  # 8 min + pénalité de 120 s
    r = resoudre(p)
    assert r["non_servis"] == []
    assert sum(len(t["arrets"]) for t in r["tournees"]) == 2


def test_le_nombre_d_equipes_peut_changer_sans_casser(tmp_path):
    ecrire_fixture(tmp_path, nb_equipes=2)
    for n in (1, 2, 3):
        r = resoudre(charger_probleme(tmp_path, nombre_equipes=n, limite_s=0.3))
        assert len(r["tournees"]) == n
        assert r["statut"] == "ok"


def test_points_differents_refuses(tmp_path):
    ecrire_fixture(tmp_path)
    pen = json.loads((tmp_path / "penalites.json").read_text())
    pen["points"] = ["B", "A", "g1"]
    (tmp_path / "penalites.json").write_text(json.dumps(pen))
    with pytest.raises(ValueError):
        charger_probleme(tmp_path)


def test_geometrie_repli_en_droite_sans_client_et_en_cas_de_panne():
    coords = [[-73.58, 45.5], [-73.58, 45.51]]
    g, source = geometrie_tournee(coords, None)
    assert source == "droite" and g["coordinates"] == coords

    def panne(_requete):
        raise httpx.ConnectError("réseau coupé")

    with httpx.Client(transport=httpx.MockTransport(panne)) as client:
        g, source = geometrie_tournee(coords, client)
    assert source == "droite" and g["coordinates"] == coords


def test_geometrie_osrm():
    coords = [[-73.58, 45.5], [-73.58, 45.51]]
    trace = [[-73.58, 45.5], [-73.581, 45.505], [-73.58, 45.51]]

    def ok(_requete):
        return httpx.Response(
            200, json={"code": "Ok", "routes": [{"geometry": {"coordinates": trace}}]}
        )

    with httpx.Client(transport=httpx.MockTransport(ok)) as client:
        g, source = geometrie_tournee(coords, client)
    assert source == "osrm" and g["coordinates"] == trace


def test_precalculer_format_du_contrat_avec_et_sans_incident(tmp_path):
    ecrire_fixture(tmp_path)
    sans, avec = precalculer(tmp_path, limite_s=0.3, utiliser_osrm=False)
    for r in (sans, avec):
        assert r["precalcule"] is True and r["statut"] == "terminee" and r["version"] == 1
        assert r["demande_id"] == "precalcule" and r["message"] is None
        assert r["source_matrice"] == "osrm_cache" or r["source_matrice"] == "vol_oiseau"
        assert "_sequences" not in r
        assert r["hypotheses_demo"]["intervention_s"] == 480
        assert [e["id"] for e in r["equipes"]] == ["e1", "e2"]
        assert r["equipes"][0]["garage"] == {"latitude": 45.5, "longitude": -73.58}
        assert r["equipes"][0]["membres"] == []
        c = r["comparaison"]
        assert set(c) == {
            "ordre_arrivee",
            "optimise",
            "gain_distance_m",
            "gain_duree_s",
            "dans_le_quart",
        }
        assert (
            c["gain_distance_m"] == c["ordre_arrivee"]["distance_m"] - c["optimise"]["distance_m"]
        )
        for t in r["tournees"]:
            assert t["geometrie"]["type"] == "LineString"
            assert t["debut_prevu"] == "2026-11-22T07:00:00-05:00"
            assert t["fin_prevue"].startswith("2026-11-22T")
            for rang, a in enumerate(t["arrets"], 1):
                assert a["rang"] == rang and a["cle_endroit"].startswith("grille:")
                assert (
                    a["arrivee_prevue"].endswith("-05:00")
                    and a["depart_prevu"] > a["arrivee_prevue"]
                )
                assert a["signalement_ids"] and a["position"]["latitude"]
        json.dumps(r)
    assert sans["incidents"] == []
    assert avec["incidents"][0]["type"] == "rue_fermee" and avec["incidents"][0]["simule"] is True
    cles = {a["cle_endroit"] for t in sans["tournees"] for a in t["arrets"]}
    assert cles == {"grille:A", "grille:B"}
    assert {
        x["signalement_ids"][0] for t in sans["tournees"] for x in t["arrets"]
    }  # ids de signalements d'exemple


def test_non_servis_au_format_du_contrat(tmp_path):
    ecrire_fixture(tmp_path)
    d = charger_donnees(tmp_path, limite_s=0.3)
    p = replace(
        d.probleme, equipes=[replace(d.probleme.equipes[0], fin_s=25200 + 100)]
    )  # quart trop court
    sortie = resoudre(p)
    r = vers_resultat(sortie, d, date(2026, 11, 22))
    assert {n["cle_endroit"] for n in r["non_servis"]} == {"grille:A", "grille:B"}
    assert r["non_servis"][0]["raison"] == "temps du quart dépassé"
    assert r["non_servis"][0]["gravite"] in ("faible", "moyenne", "elevee")


def test_ajouter_geometries_sans_osrm(tmp_path):
    ecrire_fixture(tmp_path)
    p = charger_probleme(tmp_path, limite_s=0.3)
    r = ajouter_geometries(resoudre(p), p, utiliser_osrm=False)
    assert r["tournees"][0]["geometrie"]["type"] == "LineString"


@pytest.mark.skipif(not (OUT / "matrice.json").exists(), reason="données de démo absentes")
def test_donnees_de_demo_reelles_donnent_une_solution_valide():
    p = charger_probleme(limite_s=2)
    r = resoudre(p)
    assert r["statut"] == "ok"
    servis = sum(len(t["arrets"]) for t in r["tournees"])
    assert servis + len(r["non_servis"]) == len(p.arrets)
    for t, e in zip(r["tournees"], p.equipes, strict=True):
        assert t["retour_s"] <= e.fin_s


def ecrire_fixture_large(dossier):
    """Deux garages et quatre arrêts possibles dans la matrice ; D et C ont chacun deux signalements."""
    pts = [
        {"id": "g1", "type": "garage", "latitude": 45.500, "longitude": -73.58},
        {"id": "g2", "type": "garage", "latitude": 45.520, "longitude": -73.58},
        {"id": "A", "type": "arret", "latitude": 45.501, "longitude": -73.58},
        {"id": "B", "type": "arret", "latitude": 45.502, "longitude": -73.58},
        {"id": "C", "type": "arret", "latitude": 45.519, "longitude": -73.58},
        {"id": "D", "type": "arret", "latitude": 45.518, "longitude": -73.58},
    ]
    n = len(pts)
    pos = [p["latitude"] for p in pts]
    t = [[int(abs(pos[i] - pos[j]) * 100000) for j in range(n)] for i in range(n)]
    (dossier / "matrice.json").write_text(
        json.dumps({"points": pts, "durees_s": t, "distances_m": t})
    )
    (dossier / "penalites.json").write_text(
        json.dumps(
            {"points": [p["id"] for p in pts], "penalites_s": [[0] * n] * n, "penalite_arret_s": {}}
        )
    )
    equipes = [
        {
            "id": f"e{i}",
            "nom": f"E{i}",
            "garage_id": g,
            "debut_quart": "07:00",
            "fin_quart": "14:00",
        }
        for i, g in ((1, "g1"), (2, "g2"))
    ]
    (dossier / "equipes-demo.json").write_text(
        json.dumps(
            {
                "duree_intervention_min": 8,
                "garages": [
                    {"id": "g1", "latitude": 45.5, "longitude": -73.58},
                    {"id": "g2", "latitude": 45.52, "longitude": -73.58},
                ],
                "equipes": equipes,
            }
        )
    )
    (dossier / "signalements-demo.json").write_text(
        json.dumps(
            [
                sig("A"),
                sig("B"),
                sig("C"),
                sig("C", cree="2026-11-20T11:00:00Z"),
                sig("D"),
                sig("D", cree="2026-11-20T11:30:00Z"),
            ]
        )
    )


def test_seuil_deux_aucun_point_non_retenu_n_est_visite(tmp_path):
    ecrire_fixture_large(tmp_path)
    p = charger_probleme(tmp_path, seuil=2, limite_s=0.3)
    assert {a.id for a in p.arrets} == {
        "C",
        "D",
    }  # A et B (un seul signalement) ne sont pas retenus
    r = resoudre(p)
    visites = {i for t in r["tournees"] for i in t["lieux"]}
    assert "A" not in visites and "B" not in visites
    assert {a["arret_id"] for t in r["tournees"] for a in t["arrets"]} == {"C", "D"}
    # La distance affichée est celle du plan réellement calculé : l'équipe du garage nord (g2) fait les deux.
    assert r["gain"]["optimise"]["distance_m"] == sum(t["distance_m"] for t in r["tournees"])


def test_deux_equipes_sur_quatre_arrets_garage_inutilise_et_arrets_proches(tmp_path):
    ecrire_fixture_large(tmp_path)
    p = charger_probleme(tmp_path, nombre_equipes=1, seuil=1, limite_s=0.3)
    r = resoudre(p)
    assert len(r["tournees"]) == 1
    assert all(
        "g2" not in t["lieux"] for t in r["tournees"]
    )  # le garage de l'équipe absente n'est pas visité
    p2 = charger_probleme(tmp_path, nombre_equipes=2, seuil=1, limite_s=0.3)
    r2 = resoudre(p2)
    assert {a["arret_id"] for t in r2["tournees"] for a in t["arrets"]} == {"A", "B", "C", "D"}
