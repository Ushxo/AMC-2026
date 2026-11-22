"""Équipes et garages simulés de la démo vers data/out/equipes-demo.json.

Tout ce fichier est une hypothèse de démo : les garages et les équipes ne viennent pas de la Ville.
"""

import json
from pathlib import Path

SORTIE = Path(__file__).resolve().parent.parent / "out" / "equipes-demo.json"
GRILLES = SORTIE.parent / "grilles.geojson"

# Paramètres d'hypothèse de démo.
QUART_DEBUT = "07:00"
QUART_FIN = "14:00"
DUREE_INTERVENTION_MIN = 8
VEHICULE = "Camion de nettoyage d'égouts"

# Points cibles des garages simulés (nord-ouest et sud-est du quartier). Chaque garage est posé
# sur le puisard le plus proche, donc sur une vraie rue.
GARAGES_CIBLES = [
    ("garage-1", "Garage simulé Nord", 45.5120, -73.5780),
    ("garage-2", "Garage simulé Sud", 45.4960, -73.5600),
]


def garages(grilles: dict) -> list[dict]:
    """Garages simulés, posés sur le puisard le plus proche de leur point cible."""
    resultat = []
    for ident, nom, lat, lng in GARAGES_CIBLES:
        proche = min(
            grilles["features"],
            key=lambda f: (
                (f["geometry"]["coordinates"][1] - lat) ** 2
                + ((f["geometry"]["coordinates"][0] - lng) * 0.7) ** 2
            ),
        )
        x, y = proche["geometry"]["coordinates"]
        resultat.append({"id": ident, "nom": nom, "latitude": y, "longitude": x, "simule": True})
    return resultat


def construire(grilles: dict) -> dict:
    gs = garages(grilles)
    equipes = [
        {
            "id": f"equipe-{i + 1}",
            "nom": f"Équipe {i + 1}",
            "garage_id": gs[i // 2]["id"],
            "debut_quart": QUART_DEBUT,
            "fin_quart": QUART_FIN,
            "vehicule": VEHICULE,
        }
        for i in range(4)
    ]
    return {
        "hypothese_demo": True,
        "avertissement": "Garages et équipes simulés pour la démonstration.",
        "duree_intervention_min": DUREE_INTERVENTION_MIN,
        "garages": gs,
        "equipes": equipes,
    }


def main() -> None:
    donnees = construire(json.loads(GRILLES.read_text("utf-8")))
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), "utf-8")
    print(f"{len(donnees['equipes'])} équipes, {len(donnees['garages'])} garages dans {SORTIE}")


if __name__ == "__main__":
    main()
