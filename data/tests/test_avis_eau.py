from datetime import date

from scripts import avis_eau


def avis(titre, debut, geom, type_="Eau et aqueduc"):
    return {
        "type": "Feature",
        "geometry": geom,
        "properties": {"titre": titre, "date_debut": debut, "type": type_},
    }


POINT = {"type": "Point", "coordinates": [-73.57, 45.50]}
LIGNE = {"type": "LineString", "coordinates": [[-73.57, 45.50], [-73.569, 45.501]]}


def test_ligne_devient_polygone():
    fc = avis_eau.construire(
        {"features": [avis("Coupure d'eau – Rue A", "2026-11-10T10:00:00", LIGNE)]},
        [],
        date(2026, 11, 21),
    )
    f = fc["features"][0]
    assert f["geometry"]["type"] == "Polygon"
    assert f["properties"]["type"] == "coupure" and f["properties"]["gravite"] == "moyenne"
    assert f["properties"]["placement"] == "geometrie_source"


def test_ebullition_fermee_exclue():
    src = {
        "features": [
            avis(
                "Avis préventif d’ébullition d’eau – Rue A, arrondissement de X",
                "2026-11-01T10:00:00",
                POINT,
                "Urgence",
            ),
            avis(
                "Fin de l'avis préventif d’ébullition de l’eau – Rue A, arrondissement de X",
                "2026-11-05T10:00:00",
                POINT,
                "Urgence",
            ),
            avis(
                "Avis préventif d’ébullition d’eau – Rue B",
                "2026-11-02T10:00:00",
                {"type": "Point", "coordinates": [-73.56, 45.50]},
                "Urgence",
            ),
        ]
    }
    fc = avis_eau.construire(src, [], date(2026, 11, 21))
    assert [f["properties"]["titre"][-5:] for f in fc["features"]] == ["Rue B"]
    assert fc["features"][0]["properties"]["gravite"] == "elevee"


def test_coupure_ancienne_exclue_et_hors_sujet_ignore():
    src = {
        "features": [
            avis("Coupure d'eau – Rue A", "2026-08-01T10:00:00", POINT),
            avis(
                "Entrave à la circulation – Rue A",
                "2026-11-10T10:00:00",
                POINT,
                "Circulation et transport",
            ),
        ]
    }
    assert avis_eau.construire(src, [], date(2026, 11, 21))["features"] == []


def test_placement_par_adresse_puis_aucun():
    adr = [
        {"libelle": "1700 avenue du Docteur-Penfield", "latitude": 45.4948, "longitude": -73.589}
    ]
    src = {
        "features": [
            avis(
                "Avis préventif d’ébullition d’eau – 1700, avenue du Docteur-Penfield, Ville-Marie",
                "2026-11-10T10:00:00",
                None,
                "Urgence",
            ),
            avis(
                "Avis préventif d’ébullition d’eau – Rue Inconnue",
                "2026-11-11T10:00:00",
                None,
                "Urgence",
            ),
        ]
    }
    f = avis_eau.construire(src, adr, date(2026, 11, 21))["features"]
    assert [x["properties"]["placement"] for x in f] == ["adresse", "aucun"]
    assert f[1]["geometry"] is None


def test_fichier_produit(charger):
    fc = charger("avis-eau.geojson")
    ids = [f["properties"]["id"] for f in fc["features"]]
    assert ids and len(ids) == len(set(ids))
    for f in fc["features"]:
        p = f["properties"]
        assert p["type"] in ("ebullition", "coupure")
        assert p["gravite"] == ("elevee" if p["type"] == "ebullition" else "moyenne")
        assert p["placement"] in ("geometrie_source", "adresse", "aucun")
        assert p["origine"] == "officiel" and p["debut"]
        assert f["geometry"] is None or f["geometry"]["type"] in (
            "Point",
            "Polygon",
            "MultiPolygon",
        )


def test_ebullition_ancienne_exclue():
    src = {
        "features": [
            avis(
                "Avis préventif d’ébullition d’eau – Rue A", "2026-09-01T10:00:00", POINT, "Urgence"
            ),
        ]
    }
    assert avis_eau.construire(src, [], date(2026, 11, 21))["features"] == []


def test_avis_hors_quartier_exclu():
    loin = {"type": "Point", "coordinates": [-73.70, 45.60]}
    src = {"features": [avis("Coupure d'eau – Rue A", "2026-11-10T10:00:00", loin)]}
    assert avis_eau.construire(src, [], date(2026, 11, 21))["features"] == []


def test_multipolygone_dans_le_quartier_conserve():
    multi = {
        "type": "MultiPolygon",
        "coordinates": [
            [
                [
                    [-73.57, 45.50],
                    [-73.569, 45.50],
                    [-73.569, 45.501],
                    [-73.57, 45.501],
                    [-73.57, 45.50],
                ]
            ],
            [
                [
                    [-73.56, 45.50],
                    [-73.559, 45.50],
                    [-73.559, 45.501],
                    [-73.56, 45.501],
                    [-73.56, 45.50],
                ]
            ],
        ],
    }
    src = {"features": [avis("Coupure d'eau – Rue A", "2026-11-10T10:00:00", multi)]}
    f = avis_eau.construire(src, [], date(2026, 11, 21))["features"]
    assert len(f) == 1
    assert f[0]["properties"]["placement"] == "geometrie_source"
    assert f[0]["geometry"]["type"] == "MultiPolygon"


def test_multipolygone_hors_quartier_exclu():
    loin = {
        "type": "MultiPolygon",
        "coordinates": [[[[-73.7, 45.6], [-73.69, 45.6], [-73.69, 45.61], [-73.7, 45.6]]]],
    }
    src = {"features": [avis("Coupure d'eau – Rue A", "2026-11-10T10:00:00", loin)]}
    assert avis_eau.construire(src, [], date(2026, 11, 21))["features"] == []
