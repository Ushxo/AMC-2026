import pytest

from scripts import quartier, regards


def ligne(
    id_, type_="REGARD", statut="EXISTANT", visible="OUI", lat="45.50", lng="-73.57", adr="1 rue A"
):
    return {
        "ID_REGARD": id_,
        "TYPE_REGARD_EG": type_,
        "STATUT_ACTIF": statut,
        "VISIBLE": visible,
        "LATITUDE": lat,
        "LONGITUDE": lng,
        "ADRESSE": adr,
    }


def test_filtres_et_decompte():
    lignes = [
        ligne("1"),
        ligne("1"),
        ligne("2", type_="REGARD-PUISARD", adr=""),
        ligne("3", type_="ACCES CHAMBRE"),
        ligne("4", type_="FICTIF"),
        ligne("5", statut="ABANDONNE"),
        ligne("6", visible="NON"),
        ligne("7", lat="45.9"),
        ligne("8", lat="x"),
        ligne("9", lat="45.5000004", lng="-73.5700004"),
    ]
    liste, compte = regards.construire(lignes)
    assert [r["id"] for r in liste] == ["1", "2", "9"]
    assert compte == {"lignes": 10, "quartier": 8, "existants": 7, "retenus": 3}
    assert liste[1]["adresse"] is None
    assert liste[2]["latitude"] == 45.5 and liste[2]["longitude"] == -73.57
    avec, _ = regards.construire(lignes, regards.TYPES_CHAMBRES)
    assert "3" in {r["id"] for r in avec}


def test_fichier_absent_message_clair(tmp_path):
    with pytest.raises(SystemExit) as e:
        list(regards.lire_lignes(tmp_path / "absent.csv"))
    assert "introuvable" in str(e.value) and "REGARDS_CSV" in str(e.value)


def test_lecture_csv_avec_bom(tmp_path):
    f = tmp_path / "r.csv"
    f.write_text("﻿ID_REGARD,LATITUDE,LONGITUDE\n1,45.5,-73.57\n", encoding="utf-8")
    assert next(iter(regards.lire_lignes(f)))["ID_REGARD"] == "1"


def test_fichier_produit(charger):
    liste = charger("regards.json")
    ids = [r["id"] for r in liste]
    assert liste and len(ids) == len(set(ids))
    for r in liste:
        assert set(r) == {"id", "latitude", "longitude", "adresse"}
        assert quartier.dans_quartier(r["latitude"], r["longitude"])
        assert isinstance(r["id"], str)
        assert r["adresse"] is None or isinstance(r["adresse"], str)
