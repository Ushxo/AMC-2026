import json

from scripts import copier_vers_app


def test_copie_et_meta(tmp_path):
    sortie, dest = tmp_path / "out", tmp_path / "donnees"
    sortie.mkdir()
    (sortie / "grilles.geojson").write_text(json.dumps({"features": [1, 2]}))
    (sortie / "avis-eau.geojson").write_text(
        json.dumps(
            {
                "features": [
                    {"properties": {"placement": "geometrie_source"}},
                    {"properties": {"placement": "aucun"}},
                ]
            }
        )
    )
    (sortie / "notes.txt").write_text("non copié")
    for exclu in ("matrice.json", "penalites.json", "tournees-brut.json", "nouveau-fichier.json"):
        (sortie / exclu).write_text("{}")
    (sortie / "tournees-demo.json").write_text("{}")
    copies = copier_vers_app.copier(sortie, dest)
    assert sorted(copies) == ["avis-eau.json", "grilles.json", "meta.json", "tournees-demo.json"]
    meta = json.loads((dest / "meta.json").read_text())
    assert set(meta) == {"copieDu", "quartier", "region", "sources", "avisPlaces", "adresseDemo"}
    assert meta["avisPlaces"] == {"geometrie_source": 1, "adresse": 0, "aucun": 1}
    assert meta["sources"][0]["lignes"] == 2
    assert not (dest / "notes.txt").exists()
    assert not any(
        (dest / n).exists()
        for n in ("matrice.json", "penalites.json", "tournees-brut.json", "nouveau-fichier.json")
    )


def test_liste_publique_explicite():
    assert set(copier_vers_app.PUBLICS) == {
        "adresses",
        "avis-eau",
        "chantiers",
        "equipes-demo",
        "grilles",
        "meta",
        "signalements-demo",
        "tournees-demo",
        "tournees-demo-incident",
        "zones-inondables",
    }


def test_adresse_demo():
    avis = {
        "features": [
            {
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-73.571, 45.504],
                            [-73.569, 45.504],
                            [-73.569, 45.506],
                            [-73.571, 45.506],
                            [-73.571, 45.504],
                        ]
                    ],
                },
                "properties": {
                    "type": "ebullition",
                    "debut": "2026-11-10",
                    "id": "9",
                    "titre": "T",
                },
            }
        ]
    }
    adresses = [
        {"libelle": "loin", "latitude": 45.51, "longitude": -73.55},
        {"libelle": "près", "latitude": 45.5051, "longitude": -73.5701},
    ]
    assert copier_vers_app.adresse_demo(avis, adresses)["libelle"] == "près"
    assert copier_vers_app.adresse_demo({"features": []}, adresses) is None


def test_adresse_demo_reelle_dans_le_polygone(charger):
    from shapely.geometry import Point, shape

    meta = charger("meta.json")["adresseDemo"]
    assert meta["libelle"] in {a["libelle"] for a in charger("adresses.json")}
    assert "shannon" in meta["libelle"].lower()
    zones = [
        shape(f["geometry"])
        for f in charger("avis-eau.geojson")["features"]
        if f["properties"]["type"] == "ebullition"
        and f["geometry"]
        and f["geometry"]["type"] == "Polygon"
    ]
    assert any(z.contains(Point(meta["longitude"], meta["latitude"])) for z in zones)
