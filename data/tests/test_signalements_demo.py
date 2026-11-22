import collections

from scripts import quartier, signalements_demo

CATEGORIES = {"grille_bouchee", "eau_accumulee", "eau_douteuse", "absence_eau", "autre"}
ETATS = {"nouveau", "pris_en_charge", "regle", "rejete"}


def test_reproductible_et_seuils(charger):
    grilles = charger("grilles.geojson")
    a = signalements_demo.construire(grilles)
    assert a == signalements_demo.construire(grilles)
    assert len({x["grille_id"] for x in a}) == 189
    ouverts = collections.Counter(
        s["grille_id"] for s in a if s["etat"] in ("nouveau", "pris_en_charge")
    )
    assert max(ouverts.values()) >= 50
    assert sum(1 for n in ouverts.values() if n >= 20) >= 2


def test_fichier_produit(charger):
    grilles = {f["properties"]["id"] for f in charger("grilles.geojson")["features"]}
    donnees = charger("signalements-demo.json")
    assert len({s["id"] for s in donnees}) == len(donnees)
    assert len({s["etat"] for s in donnees}) >= 3
    for s in donnees:
        assert s["exemple_demo"] is True and s["origine"] == "citoyen"
        assert s["categorie"] in CATEGORIES and s["etat"] in ETATS
        assert s["gravite"] in ("faible", "moyenne", "elevee")
        assert s["photo_url"] is None
        assert s["grille_id"] in grilles
        assert quartier.dans_quartier(s["latitude"], s["longitude"])
        assert s["etat_change_le"] >= s["cree_le"]
