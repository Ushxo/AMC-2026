from shapely.geometry import box, shape

from scripts import zones_inondables


def carre(x, y, taille=0.01):
    return {
        "type": "Polygon",
        "coordinates": [
            [[x, y], [x + taille, y], [x + taille, y + taille], [x, y + taille], [x, y]]
        ],
    }


def test_construire_retire_sans_donnees_et_simplifie():
    source = {
        "features": [
            {"geometry": carre(-73.6, 45.5), "properties": {"CruesCl": "4", "CruesCat": "Élevée"}},
            {"geometry": carre(-73.5, 45.5), "properties": {"CruesCl": "NoData"}},
            {"geometry": carre(-73.55, 45.5, 1e-6), "properties": {"CruesCl": "3"}},
            {"geometry": carre(-73.4, 45.5), "properties": {"CruesCl": "1"}},
            {"geometry": carre(-73.45, 45.5), "properties": {"CruesCl": "2"}},
        ]
    }
    fc = zones_inondables.construire(source)
    assert [f["properties"]["id"] for f in fc["features"]] == ["crues-2022-4"]
    assert fc["features"][0]["geometry"]["type"] == "MultiPolygon"
    assert set(fc["features"][0]["properties"]) == {"id", "origine", "gravite", "source"}


def test_fichier_produit(charger):
    from pathlib import Path

    fc = charger("zones-inondables.geojson")
    ids = [f["properties"]["id"] for f in fc["features"]]
    assert sorted(ids) == ["crues-2022-3", "crues-2022-4", "crues-2022-5"]
    ile = box(-74.1, 45.3, -73.3, 45.8)
    for f in fc["features"]:
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
        assert ile.contains(shape(f["geometry"]))
        assert f["properties"] == {
            "id": f["properties"]["id"],
            "origine": "officiel",
            "gravite": "moyenne",
            "source": "Vulnérabilité aux crues, 2022",
        }
    chemin = Path(__file__).resolve().parent.parent / "out" / "zones-inondables.geojson"
    assert chemin.stat().st_size < 1_000_000
