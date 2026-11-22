import importlib
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from ml_egouts.entrainer import entrainer
from ml_egouts.modele import charger_modele
from ml_egouts.predire import predire

COULEURS = [(220, 40, 40), (40, 200, 40), (40, 40, 220), (230, 230, 40)]


@pytest.fixture(scope="module")
def modele_entraine(tmp_path_factory):
    racine = tmp_path_factory.mktemp("ml")
    for classe, couleur in zip(("invalide", "faible", "moyenne", "elevee"), COULEURS):
        (racine / "images" / classe).mkdir(parents=True)
        for i in range(5):
            Image.new("RGB", (80, 60), couleur).save(racine / "images" / classe / f"{i}.png")
    entrainer(
        racine / "images", racine / "modeles", epoques=1, epoques_tete=1, taille_lot=8,
        pre_entraine=False, appareil="cpu", afficher=lambda *_: None,
    )
    return racine


@pytest.fixture(scope="module")
def client(modele_entraine):
    mp = pytest.MonkeyPatch()
    mp.setenv("DOSSIER_MODELE", str(modele_entraine / "modeles"))
    import serveur.app

    module = importlib.reload(serveur.app)
    yield TestClient(module.app)
    mp.undo()


def png(couleur=(40, 40, 220), taille=(300, 200)) -> bytes:
    tampon = io.BytesIO()
    Image.new("RGB", taille, couleur).save(tampon, format="PNG")
    return tampon.getvalue()


def test_sante(client):
    reponse = client.get("/sante")
    assert reponse.status_code == 200
    assert reponse.json()["classes"] == ["invalide", "faible", "moyenne", "elevee"]


def test_juger_une_photo(client):
    reponse = client.post("/juger", files={"photo": ("grille.png", png(), "image/png")})
    assert reponse.status_code == 200
    corps = reponse.json()
    assert set(corps) == {"valide", "probabilite_valide", "score_gravite", "gravite", "probabilites"}
    assert corps["valide"] == (corps["gravite"] is not None)
    assert abs(sum(corps["probabilites"].values()) - 100) <= 2


def test_refuse_un_fichier_qui_n_est_pas_une_image(client):
    reponse = client.post("/juger", files={"photo": ("x.jpg", b"pas une image", "image/jpeg")})
    assert reponse.status_code == 400


def test_refuse_une_requete_sans_photo(client):
    assert client.post("/juger").status_code == 422


def test_onnx_donne_les_memes_probabilites_que_pytorch(client, modele_entraine, tmp_path):
    chemin = tmp_path / "photo.png"
    chemin.write_bytes(png(couleur=(120, 90, 60), taille=(640, 480)))
    attendu = predire(charger_modele(str(modele_entraine / "modeles" / "modele.pt")), chemin)

    obtenu = client.post(
        "/juger", files={"photo": ("photo.png", chemin.read_bytes(), "image/png")}
    ).json()
    for classe, p in attendu["probabilites"].items():
        assert abs(obtenu["probabilites"][classe] - p) <= 2
    if attendu["score_gravite"] is not None and obtenu["score_gravite"] is not None:
        assert abs(obtenu["score_gravite"] - attendu["score_gravite"]) <= 3
