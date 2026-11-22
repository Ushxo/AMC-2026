"""Signalements d'exemple du quartier de démo vers data/out/signalements-demo.json."""

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

SORTIE = Path(__file__).resolve().parent.parent / "out" / "signalements-demo.json"
GRILLES = SORTIE.parent / "grilles.geojson"

GRAINE = 2026
REFERENCE = datetime(2026, 11, 20, 12, 0, tzinfo=UTC)
NB_GROS = 55
NB_MOYEN = 22
NB_ISOLES = 187  # avec les 2 gros endroits : 189 puisards distincts, donc 189 arrêts
# Nombre de signalements réglés dans chaque gros endroit : ils ne comptent plus.
NB_REGLES_GROS = 3
NB_REGLES_MOYEN = 2
ESPACE_NOM = uuid.UUID("6b1f0c52-0f0c-4d6e-9a53-3f2a7c1d9e10")

CATEGORIES_ARRETS = ["grille_bouchee", "eau_accumulee", "eau_douteuse", "absence_eau", "autre"]
POIDS_CATEGORIES = [60, 25, 7, 4, 4]

COMMENTAIRES = [
    "Grille pleine de feuilles.",
    "L'eau ne s'écoule plus après la pluie.",
    "Flaque très grande devant la grille.",
    "Déjà signalé la semaine dernière.",
    "Odeur et eau stagnante.",
]


def _etat(rng: random.Random, permettre_rejet: bool, force: str | None = None) -> str:
    if force:
        return force
    tirage = rng.random()
    if tirage < 0.45:
        return "nouveau"
    if tirage < 0.72:
        return "pris_en_charge"
    if tirage < 0.92 or not permettre_rejet:
        return "regle"
    return "rejete"


def _signalement(rng, grille, categorie, gravite, rejet_permis, numero, force=None) -> dict:
    lng, lat = grille["geometry"]["coordinates"]
    cree = REFERENCE - timedelta(minutes=rng.randint(30, 14 * 24 * 60))
    etat = _etat(rng, rejet_permis, force)
    change = cree if etat == "nouveau" else cree + timedelta(minutes=rng.randint(10, 3 * 24 * 60))
    return {
        "id": str(uuid.uuid5(ESPACE_NOM, f"{GRAINE}-{numero}")),
        "origine": "citoyen",
        "cree_le": cree.isoformat().replace("+00:00", "Z"),
        "latitude": round(lat + rng.uniform(-0.00006, 0.00006), 6),
        "longitude": round(lng + rng.uniform(-0.00006, 0.00006), 6),
        "categorie": categorie,
        "gravite": gravite,
        "commentaire": rng.choice(COMMENTAIRES) if rng.random() < 0.3 else None,
        "photo_url": None,
        "grille_id": grille["properties"]["id"],
        "etat": etat,
        "etat_change_le": change.isoformat().replace("+00:00", "Z"),
        "exemple_demo": True,
    }


def construire(grilles: dict) -> list[dict]:
    """Un endroit à 55 signalements, un à 22, 187 isolés : 189 puisards distincts. Graine fixe."""
    rng = random.Random(GRAINE)
    candidates = [f for f in grilles["features"] if f["properties"]["adresse"]]
    candidates.sort(key=lambda f: f["properties"]["id"])
    choisies = rng.sample(candidates, 2 + NB_ISOLES)
    gros, moyen, isoles = choisies[0], choisies[1], choisies[2:]
    resultat: list[dict] = []
    n = 0
    for i in range(NB_GROS):
        force = "regle" if i < NB_REGLES_GROS else rng.choice(["nouveau", "pris_en_charge"])
        cat = "grille_bouchee" if rng.random() < 0.8 else "eau_accumulee"
        resultat.append(
            _signalement(rng, gros, cat, rng.choice(["faible", "moyenne"]), False, n, force)
        )
        n += 1
    for i in range(NB_MOYEN):
        force = "regle" if i < NB_REGLES_MOYEN else rng.choice(["nouveau", "pris_en_charge"])
        cat = "grille_bouchee" if rng.random() < 0.7 else "eau_accumulee"
        resultat.append(
            _signalement(rng, moyen, cat, rng.choice(["faible", "moyenne"]), False, n, force)
        )
        n += 1
    for grille in isoles:
        cat = rng.choices(CATEGORIES_ARRETS, weights=POIDS_CATEGORIES)[0]
        gravite = rng.choices(["faible", "moyenne", "elevee"], weights=[50, 35, 15])[0]
        force = rng.choices(["nouveau", "pris_en_charge"], weights=[70, 30])[0]
        resultat.append(_signalement(rng, grille, cat, gravite, False, n, force))
        n += 1
    resultat.sort(key=lambda s: s["cree_le"], reverse=True)
    return resultat


def main() -> None:
    grilles = json.loads(GRILLES.read_text("utf-8"))
    donnees = construire(grilles)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), "utf-8")
    print(f"{len(donnees)} signalements écrits dans {SORTIE}")


if __name__ == "__main__":
    main()
