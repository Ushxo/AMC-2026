"""API de prédiction pour l'app : juge une photo d'égout.

    POST /juger   (multipart, champ "photo")
      → {"valide": true, "probabilite_valide": 98, "score_gravite": 87,
         "gravite": "elevee", "probabilites": {...}}   (pourcentages 0-100)
      score_gravite : voir ml_egouts/score.py ; null si la photo est invalide.
    GET  /sante   → {"ok": true}  (à appeler pour réveiller le serveur avant la démo)

N'utilise pas PyTorch : le modèle exporté en ONNX tourne avec onnxruntime,
ce qui garde l'image Docker petite et la mémoire sous 200 Mo.

En local, depuis ml/ :
    uv run uvicorn serveur.app:app --reload
"""

import io
import json
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from ml_egouts.score import resultat

DOSSIER_MODELE = Path(os.environ.get("DOSSIER_MODELE", Path(__file__).parent.parent / "modeles"))
TAILLE_MAX_OCTETS = 10 * 1024 * 1024
MOYENNE = np.array([0.485, 0.456, 0.406], dtype=np.float32)
ECART_TYPE = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def charger(dossier: Path) -> tuple[ort.InferenceSession, list[str], int]:
    infos = json.loads((dossier / "metriques.json").read_text(encoding="utf-8"))
    session = ort.InferenceSession(
        str(dossier / "modele.onnx"), providers=["CPUExecutionProvider"]
    )
    return session, infos["classes"], infos["taille_image"]


def preparer(image: Image.Image, taille: int) -> np.ndarray:
    """Même traitement que pour la validation à l'entraînement :
    petit côté à 256 px (pour 224), recadrage central, normalisation ImageNet."""
    image = image.convert("RGB")
    cote = round(taille * 256 / 224)
    largeur, hauteur = image.size
    echelle = cote / min(largeur, hauteur)
    image = image.resize(
        (max(cote, round(largeur * echelle)), max(cote, round(hauteur * echelle))),
        Image.Resampling.BILINEAR,
    )
    largeur, hauteur = image.size
    gauche, haut = (largeur - taille) // 2, (hauteur - taille) // 2
    image = image.crop((gauche, haut, gauche + taille, haut + taille))
    tableau = (np.asarray(image, dtype=np.float32) / 255.0 - MOYENNE) / ECART_TYPE
    return tableau.transpose(2, 0, 1)[np.newaxis]


def juger(session: ort.InferenceSession, classes: list[str], taille: int, image: Image.Image):
    scores = session.run(None, {"image": preparer(image, taille)})[0][0]
    exp = np.exp(scores - scores.max())
    return resultat(classes, (exp / exp.sum()).tolist())


app = FastAPI(title="Juge de photos d'égouts")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"])
_session, _classes, _taille = charger(DOSSIER_MODELE)


@app.get("/sante")
def sante():
    return {"ok": True, "classes": _classes}


@app.post("/juger")
async def juger_photo(photo: UploadFile):
    contenu = await photo.read(TAILLE_MAX_OCTETS + 1)
    if len(contenu) > TAILLE_MAX_OCTETS:
        raise HTTPException(413, "Photo trop lourde (10 Mo maximum).")
    try:
        image = Image.open(io.BytesIO(contenu))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "Le fichier envoyé n'est pas une image lisible.")
    return juger(_session, _classes, _taille, image)
