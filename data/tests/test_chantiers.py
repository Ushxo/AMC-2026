from datetime import date

from scripts import chantiers, quartier


def ligne(id_, debut, fin, lat="45.50", lng="-73.57"):
    return {
        "permit_permit_id": id_,
        "organizationname": " Ville ",
        "duration_start_date": debut,
        "duration_end_date": fin,
        "latitude": lat,
        "longitude": lng,
    }


def test_construire_filtre_actifs_dans_quartier():
    lignes = [
        ligne("A", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
        ligne("A", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
        ligne("B", "2026-01-01T00:00:00Z", "2026-05-01T00:00:00Z"),
        ligne("C", "2027-01-01T00:00:00Z", "2027-02-01T00:00:00Z"),
        ligne("D", "2026-01-01T00:00:00Z", None, lat="45.9"),
        ligne("E", "2026-01-01T00:00:00Z", None),
    ]
    fc = chantiers.construire(lignes, date(2026, 11, 21))
    assert [f["properties"]["id"] for f in fc["features"]] == ["A", "E"]
    assert fc["features"][0]["properties"]["entreprise"] == "Ville"
    assert fc["features"][1]["properties"]["fin"] is None


def test_fichier_produit(charger):
    fc = charger("chantiers.geojson")
    ids = [f["properties"]["id"] for f in fc["features"]]
    assert ids and len(ids) == len(set(ids))
    for f in fc["features"]:
        lng, lat = f["geometry"]["coordinates"]
        assert f["geometry"]["type"] == "Point" and quartier.dans_quartier(lat, lng)
        p = f["properties"]
        assert p["origine"] == "officiel" and p["gravite"] == "faible" and p["debut"]
