import json

import pytest
from PIL import Image

from ml_egouts import CLASSES
from ml_egouts.donnees import compter, lister_images, separer
from ml_egouts.entrainer import entrainer, matrice_confusion, metriques
from ml_egouts.modele import charger_modele
from ml_egouts.predire import predire

CLES = {"valide", "probabilite_valide", "score_gravite", "gravite", "probabilites"}
COULEURS = {"invalide": (220, 40, 40), "faible": (40, 200, 40),
            "moyenne": (40, 40, 220), "elevee": (230, 230, 40)}


@pytest.fixture
def jeu_de_donnees(tmp_path):
    """6 petites images unies par classe, une couleur par classe."""
    dossier = tmp_path / "images"
    for classe, couleur in COULEURS.items():
        (dossier / classe).mkdir(parents=True)
        for i in range(6):
            Image.new("RGB", (64, 48), couleur).save(dossier / classe / f"{i}.png")
    (dossier / "faible" / "notes.txt").write_text("pas une image")
    return dossier


def test_lister_ignore_les_fichiers_non_images(jeu_de_donnees):
    exemples = lister_images(jeu_de_donnees)
    assert compter(exemples) == {c: 6 for c in CLASSES}


def test_separer_garde_chaque_classe_des_deux_cotes(jeu_de_donnees):
    entrainement, validation = separer(lister_images(jeu_de_donnees), part_validation=0.2)
    assert all(n >= 1 for n in compter(validation).values())
    assert all(n >= 1 for n in compter(entrainement).values())
    assert len(entrainement) + len(validation) == 24


def test_separer_est_reproductible(jeu_de_donnees):
    exemples = lister_images(jeu_de_donnees)
    assert separer(exemples) == separer(exemples)


def test_metriques_sur_une_matrice_connue():
    matrice = matrice_confusion([0, 1, 2, 3, 3], [0, 1, 2, 3, 2])
    m = metriques(matrice)
    assert m["exactitude"] == 0.8
    assert m["par_classe"]["elevee"]["rappel"] == 0.5
    assert m["par_classe"]["invalide"]["f1"] == 1.0


def test_refuse_un_jeu_incomplet(tmp_path):
    (tmp_path / "faible").mkdir()
    Image.new("RGB", (8, 8)).save(tmp_path / "faible" / "a.png")
    with pytest.raises(SystemExit, match="Pas assez de photos"):
        entrainer(tmp_path, tmp_path / "sortie", afficher=lambda *_: None)


def test_entrainement_puis_prediction_de_bout_en_bout(jeu_de_donnees, tmp_path):
    sortie = tmp_path / "modeles"
    resume = entrainer(
        jeu_de_donnees, sortie, epoques=2, epoques_tete=1, taille_lot=8,
        pre_entraine=False, appareil="cpu", afficher=lambda *_: None,
    )
    assert (sortie / "modele.pt").exists()
    assert (sortie / "modele.onnx").exists()
    assert json.loads((sortie / "metriques.json").read_text("utf-8"))["classes"] == list(CLASSES)
    assert resume["meilleure_validation"]["epoque"] in (1, 2)

    modele = charger_modele(str(sortie / "modele.pt"))
    resultat = predire(modele, jeu_de_donnees / "elevee" / "0.png")
    assert set(resultat) == CLES
    assert abs(sum(resultat["probabilites"].values()) - 100) <= 2
    assert resultat["valide"] == (resultat["gravite"] is not None)
