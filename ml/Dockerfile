# Serveur de prédiction pour Google Cloud Run.
# Le modèle doit être entraîné avant : ml/modeles/modele.onnx et metriques.json.
FROM python:3.12-slim

WORKDIR /app
COPY serveur/requirements.txt serveur/requirements.txt
RUN pip install --no-cache-dir -r serveur/requirements.txt

COPY serveur/ serveur/
COPY ml_egouts/__init__.py ml_egouts/score.py ml_egouts/
COPY modeles/modele.onnx modeles/metriques.json modeles/

# Cloud Run fournit le port dans $PORT.
CMD exec uvicorn serveur.app:app --host 0.0.0.0 --port ${PORT:-8080}
