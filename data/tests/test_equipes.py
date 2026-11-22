from scripts import equipes


def test_garages_sur_des_puisards_et_equipes(charger):
    grilles = charger("grilles.geojson")
    d = equipes.construire(grilles)
    positions = {tuple(f["geometry"]["coordinates"]) for f in grilles["features"]}
    assert d["hypothese_demo"] is True and d["duree_intervention_min"] == 8
    assert len(d["garages"]) == 2 and len(d["equipes"]) == 4
    for g in d["garages"]:
        assert g["simule"] is True and (g["longitude"], g["latitude"]) in positions
    ids = {g["id"] for g in d["garages"]}
    assert all(e["garage_id"] in ids for e in d["equipes"])
    assert {e["debut_quart"] for e in d["equipes"]} == {"07:00"}


def test_fichier_produit(charger):
    assert charger("equipes-demo.json") == equipes.construire(charger("grilles.geojson"))
