import httpx

from scripts import matrice

POINTS = [
    {"id": "g", "type": "garage", "latitude": 45.50, "longitude": -73.57},
    {"id": "a", "type": "arret", "latitude": 45.51, "longitude": -73.56},
    {"id": "b", "type": "arret", "latitude": 45.50, "longitude": -73.55},
]


def test_repli_vol_oiseau_sans_client():
    durees, distances, repli, blocs = matrice.construire(POINTS, None)
    assert repli == 9 and blocs == [[0, 0]]
    assert durees[0][0] == 0 and durees[0][1] > 0
    assert all(isinstance(v, int) for ligne in durees for v in ligne)
    assert distances[0][1] == distances[1][0]


def test_decoupage_en_blocs_et_reponse_osrm(monkeypatch):
    monkeypatch.setattr(matrice, "TAILLE_BLOC", 2)
    appels = []

    def gestionnaire(requete: httpx.Request) -> httpx.Response:
        appels.append(str(requete.url))
        coords = requete.url.path.rsplit("/", 1)[-1].split(";")
        srcs = requete.url.params["sources"].split(";")
        dsts = requete.url.params["destinations"].split(";")
        assert len(coords) <= 100
        d = [[10.4 for _ in dsts] for _ in srcs]
        return httpx.Response(200, json={"code": "Ok", "durations": d, "distances": d})

    client = httpx.Client(transport=httpx.MockTransport(gestionnaire))
    durees, distances, repli, blocs = matrice.construire(POINTS, client, pause=0)
    assert len(appels) == 4 and repli == 0 and blocs == []
    assert durees[0][1] == 10 and durees[1][1] == 0 and distances[2][0] == 10


def test_echec_osrm_retombe_sur_le_vol_oiseau(monkeypatch):
    monkeypatch.setattr(matrice, "PAUSE_S", 0)
    monkeypatch.setattr(matrice, "ESSAIS", 1)
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    _, _, repli, blocs = matrice.construire(POINTS, client, pause=0)
    assert repli == 9 and blocs == [[0, 0]]


def test_points_garages_puis_arrets_ouverts():
    grilles = {
        "features": [
            {"properties": {"id": "x"}, "geometry": {"coordinates": [-73.57, 45.50]}},
            {"properties": {"id": "y"}, "geometry": {"coordinates": [-73.56, 45.51]}},
        ]
    }
    signalements = [
        {"grille_id": "y", "etat": "nouveau"},
        {"grille_id": "y", "etat": "regle"},
        {"grille_id": "x", "etat": "regle"},
    ]
    pts = matrice.construire_points(grilles, signalements)
    assert [p["type"] for p in pts] == ["garage", "garage", "arret"]
    assert pts[-1]["id"] == "y"


def test_fichier_produit(charger):
    m = charger("matrice.json")
    n = len(m["points"])
    assert n == 191 and sum(p["type"] == "arret" for p in m["points"]) == 189
    assert [p["type"] for p in m["points"][:2]] == ["garage", "garage"]
    assert len(m["durees_s"]) == n == len(m["distances_m"])
    assert all(len(r) == n for r in m["durees_s"] + m["distances_m"])
    assert all(m["durees_s"][i][i] == 0 for i in range(n))
    assert all(isinstance(v, int) for r in m["durees_s"] for v in r)
    assert m["source"] in ("osrm", "mixte", "vol_oiseau") and m["date"]
    assert any(m["durees_s"][i][j] != m["durees_s"][j][i] for i in range(n) for j in range(n))


def test_points_de_la_matrice_sont_les_arrets_ouverts(charger):
    ouverts = {
        s["grille_id"]
        for s in charger("signalements-demo.json")
        if s["etat"] in ("nouveau", "pris_en_charge")
    }
    arrets = {p["id"] for p in charger("matrice.json")["points"] if p["type"] == "arret"}
    assert arrets == ouverts
