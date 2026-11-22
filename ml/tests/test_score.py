from ml_egouts import CLASSES
from ml_egouts.score import resultat


def test_hesitation_entre_moyenne_et_elevee():
    r = resultat(CLASSES, [0.0, 0.0, 0.6, 0.4])
    assert r == {
        "valide": True,
        "probabilite_valide": 100,
        "score_gravite": 70,
        "gravite": "moyenne",
        "probabilites": {"invalide": 0, "faible": 0, "moyenne": 60, "elevee": 40},
    }


def test_score_ignore_la_part_invalide():
    # 20 % invalide : le score ne se calcule que sur les 80 % de gravité.
    r = resultat(CLASSES, [0.2, 0.0, 0.0, 0.8])
    assert r["score_gravite"] == 100
    assert r["probabilite_valide"] == 80


def test_extremes():
    assert resultat(CLASSES, [0.0, 1.0, 0.0, 0.0])["score_gravite"] == 0
    assert resultat(CLASSES, [0.0, 0.0, 0.0, 1.0])["score_gravite"] == 100


def test_photo_invalide():
    r = resultat(CLASSES, [0.7, 0.1, 0.1, 0.1])
    assert r["valide"] is False
    assert r["score_gravite"] is None and r["gravite"] is None
    assert r["probabilite_valide"] == 30
