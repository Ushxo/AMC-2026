from scripts import penalites

PTS = [
    {"id": "A", "type": "arret", "latitude": 45.5000, "longitude": -73.5700},
    {"id": "B", "type": "arret", "latitude": 45.5000, "longitude": -73.5600},
    {"id": "C", "type": "arret", "latitude": 45.5100, "longitude": -73.5700},
]


def permis(lat, lng, penalite, type_="Rue barrée"):
    return {
        "id": "P",
        "latitude": lat,
        "longitude": lng,
        "penalite_s": penalite,
        "type_impact": type_,
        "rues": [],
        "entreprise": None,
    }


def test_segment_proche_pénalisé_et_symétrique():
    mat, arrets = penalites.calculer(PTS, [permis(45.5000, -73.5650, 300)])
    assert mat[0][1] == mat[1][0] == 300
    assert mat[0][2] == 0 and mat[1][2] == 0 and mat[0][0] == 0
    assert arrets == {}


def test_arret_proche_d_une_rue_barree():
    _, arrets = penalites.calculer(PTS, [permis(45.50001, -73.57001, 300)])
    assert arrets == {"A": 300}
    _, arrets = penalites.calculer(
        PTS, [permis(45.50001, -73.57001, 120, "Voie de circulation obstruée")]
    )
    assert arrets == {}


def test_plafond_par_paire():
    ps = [permis(45.5, -73.565, 300), permis(45.5, -73.566, 300), permis(45.5, -73.567, 300)]
    mat, _ = penalites.calculer(PTS, ps)
    assert mat[0][1] == penalites.PLAFOND_PAIRE_S


def test_regrouper_permis_garde_la_pire_penalite():
    lignes = [
        {
            "permis": "X",
            "impact": "Voie de stationnement obstruée",
            "latitude": "45.5",
            "longitude": "-73.5",
            "entreprise": "V",
            "rue": "Rue A",
        },
        {
            "permis": "X",
            "impact": "Rue barrée",
            "latitude": "45.5",
            "longitude": "-73.5",
            "entreprise": "V",
            "rue": "Rue B",
        },
        {
            "permis": "Y",
            "impact": "Voie de stationnement obstruée",
            "latitude": "45.5",
            "longitude": "-73.5",
            "entreprise": None,
            "rue": "Rue C",
        },
    ]
    r = penalites.regrouper_permis(lignes)
    assert [(p["id"], p["penalite_s"], p["rues"]) for p in r] == [("X", 300, ["Rue A", "Rue B"])]


def test_fichier_produit(charger):
    p = charger("penalites.json")
    m = charger("matrice.json")
    assert p["points"] == [pt["id"] for pt in m["points"]]
    n = len(p["points"])
    assert len(p["penalites_s"]) == n and all(len(r) == n for r in p["penalites_s"])
    assert all(p["penalites_s"][i][i] == 0 for i in range(n))
    assert max(v for r in p["penalites_s"] for v in r) <= p["regle"]["plafond_paire_s"]
    assert p["permis"] and all(x["penalite_s"] > 0 for x in p["permis"])
    assert set(p["penalite_arret_s"]) <= set(p["points"])
