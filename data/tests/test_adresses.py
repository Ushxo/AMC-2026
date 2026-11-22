from pathlib import Path

from scripts import adresses

OUT = Path(__file__).resolve().parent.parent / "out"


def test_construire_dedoublonne():
    g = {
        "features": [
            {"geometry": {"coordinates": [-73.5, 45.5]}, "properties": {"adresse": "1 rue A"}},
            {"geometry": {"coordinates": [-73.6, 45.6]}, "properties": {"adresse": "1 rue A"}},
            {"geometry": {"coordinates": [-73.6, 45.6]}, "properties": {"adresse": None}},
        ]
    }
    assert adresses.construire(g) == [{"libelle": "1 rue A", "latitude": 45.5, "longitude": -73.5}]


def test_fichier_produit(charger):
    liste = charger("adresses.json")
    assert liste
    libelles = [a["libelle"] for a in liste]
    assert len(libelles) == len(set(libelles))
    assert all(set(a) == {"libelle", "latitude", "longitude"} for a in liste)
    assert all(45.40 <= a["latitude"] <= 45.71 for a in liste)
    assert (OUT / "adresses.json").stat().st_size < 500_000
