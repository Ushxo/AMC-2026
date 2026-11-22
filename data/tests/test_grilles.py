from scripts import grilles, quartier

LIGNES = [
    {
        "ID_PUISARD": "1",
        "ADRESSE": " 1 rue A ",
        "PROVENANCE_DONNEE": "X",
        "LATITUDE": "45.50",
        "LONGITUDE": "-73.57",
    },
    {
        "ID_PUISARD": "1",
        "ADRESSE": "doublon",
        "PROVENANCE_DONNEE": None,
        "LATITUDE": "45.50",
        "LONGITUDE": "-73.57",
    },
    {
        "ID_PUISARD": "2",
        "ADRESSE": "",
        "PROVENANCE_DONNEE": None,
        "LATITUDE": "45.90",
        "LONGITUDE": "-73.57",
    },
    {
        "ID_PUISARD": "3",
        "ADRESSE": None,
        "PROVENANCE_DONNEE": None,
        "LATITUDE": "x",
        "LONGITUDE": "-73.57",
    },
]


def test_construire_filtre_et_dedoublonne():
    fc = grilles.construire(LIGNES)
    assert [f["properties"]["id"] for f in fc["features"]] == ["1"]
    assert fc["features"][0]["properties"]["adresse"] == "1 rue A"


def test_fichier_produit(charger):
    fc = charger("grilles.geojson")
    ids = [f["properties"]["id"] for f in fc["features"]]
    assert ids and len(ids) == len(set(ids))
    for f in fc["features"]:
        p = f["properties"]
        assert f["geometry"]["type"] == "Point"
        lng, lat = f["geometry"]["coordinates"]
        assert 45.40 <= lat <= 45.71 and -73.98 <= lng <= -73.47
        assert quartier.dans_quartier(lat, lng)
        assert p["origine"] == "officiel" and p["gravite"] == "faible"
        assert isinstance(p["id"], str)
        assert p["adresse"] is None or isinstance(p["adresse"], str)
        assert p["provenance"] is None or isinstance(p["provenance"], str)
