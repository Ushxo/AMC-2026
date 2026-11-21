from scripts.portail import corps_recherche


def test_corps_sans_filtre():
    assert corps_recherche("abc") == {"resource_id": "abc", "limit": 100}


def test_corps_avec_filtre():
    corps = corps_recherche("abc", {"ARROND": "Verdun"}, limite=5)
    assert corps["filters"] == {"ARROND": "Verdun"}
    assert corps["limit"] == 5
