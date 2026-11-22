"""Télécharge des photos libres de Wikimedia Commons dans ml/donnees/brut/.

    uv run python -m ml_egouts.telecharger_commons              (tout)
    uv run python -m ml_egouts.telecharger_commons hors_sujet   (un seul dossier)

Chaque catégorie Commons va dans un sous-dossier de brut/ (à trier ensuite
dans images/<classe>/). Les crédits (auteur, licence, lien) de chaque photo
sont ajoutés à brut/credits.csv : les licences CC BY / CC BY-SA demandent de
citer les auteurs, par exemple sur une slide de la présentation.
"""

import csv
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
AGENT = "ml-egouts-hackathon/0.1 (projet etudiant)"
LARGEUR = 500  # taille de vignette standard de Wikimedia (moins de refus 429)
PAUSE = 1.0  # secondes entre deux appels, pour respecter les limites de Wikimedia
LICENCES_OK = re.compile(r"^(cc0|public domain|pd|cc by(-sa)?( \d\.\d)?)", re.IGNORECASE)

# dossier de destination -> catégories Commons (sous-catégories incluses sur 1 niveau)
CATEGORIES = {
    "grilles": ["Storm drains", "Drain covers"],
    "inondations": ["Urban flooding"],
    # Rues et routes inondées sans grille visible : le modèle hésitait sur ce cas.
    "routes_inondees": ["Flooded roads", "Water bogging", "Vehicles fording"],
    # Ce qu'un citoyen pourrait envoyer par erreur : rue sans grille, trottoir,
    # voiture, intérieur, selfie, animal, nourriture, photo floue.
    "hors_sujet": [
        "Selfies", "Sidewalks", "Parked cars", "Living rooms", "Kitchens",
        "Dogs", "Cats", "Food", "Motion blur", "Out-of-focus photographs",
        "Road surfaces", "Lawns",
    ],
}
MAX_PAR_CATEGORIE = {"hors_sujet": 20}
# Certaines catégories ont des centaines de sous-catégories : on n'en explore que quelques-unes.
MAX_SOUS_CATEGORIES = 5


def appeler(parametres: dict, essais: int = 5) -> dict:
    url = API + "?" + urllib.parse.urlencode({**parametres, "format": "json"})
    for essai in range(essais):
        requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
        try:
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                texte = reponse.read().decode("utf-8")
            time.sleep(PAUSE)
            return json.loads(texte)
        except (json.JSONDecodeError, OSError):
            time.sleep(PAUSE * 5 * (essai + 1))
    raise RuntimeError(f"Wikimedia ne répond pas : {url}")


def membres(categorie: str, type_: str) -> list[str]:
    titres, suite = [], {}
    while True:
        d = appeler({
            "action": "query", "list": "categorymembers", "cmtitle": f"Category:{categorie}",
            "cmtype": type_, "cmlimit": "500", **suite,
        })
        titres += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d:
            return titres
        suite = d["continue"]


def infos_fichiers(titres: list[str]) -> list[dict]:
    infos = []
    for i in range(0, len(titres), 40):
        d = appeler({
            "action": "query", "titles": "|".join(titres[i:i + 40]), "prop": "imageinfo",
            "iiprop": "url|extmetadata|mime", "iiurlwidth": str(LARGEUR),
        })
        for page in d["query"]["pages"].values():
            ii = (page.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            if ii.get("mime") not in ("image/jpeg", "image/png"):
                continue
            licence = meta.get("LicenseShortName", {}).get("value", "")
            if not LICENCES_OK.match(licence):
                continue
            auteur = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
            infos.append({
                "titre": page["title"], "url": ii.get("thumburl") or ii["url"],
                "page": ii.get("descriptionurl", ""), "auteur": auteur, "licence": licence,
            })
    return infos


def nom_fichier(titre: str) -> str:
    nom = re.sub(r"[^\w.-]+", "_", titre.removeprefix("File:"))[:120]
    return nom if nom.lower().endswith((".jpg", ".jpeg", ".png")) else nom + ".jpg"


def telecharger(dossier_brut: Path, dossiers: list[str] | None = None) -> None:
    dossier_brut.mkdir(parents=True, exist_ok=True)
    chemin_credits = dossier_brut / "credits.csv"
    deja = set()
    if chemin_credits.exists():
        with chemin_credits.open(encoding="utf-8", newline="") as f:
            deja = {ligne["fichier"] for ligne in csv.DictReader(f)}

    with chemin_credits.open("a", encoding="utf-8", newline="") as f:
        credits = csv.DictWriter(f, ["fichier", "auteur", "licence", "page"])
        if not deja:
            credits.writeheader()
        for dossier, categories in CATEGORIES.items():
            if dossiers and dossier not in dossiers:
                continue
            cible = dossier_brut / dossier
            cible.mkdir(exist_ok=True)
            maximum = MAX_PAR_CATEGORIE.get(dossier, 10_000)
            for categorie in categories:
                titres = membres(categorie, "file")
                if len(titres) < maximum:
                    for sous in membres(categorie, "subcat")[:MAX_SOUS_CATEGORIES]:
                        titres += membres(sous.removeprefix("Category:"), "file")
                titres = list(dict.fromkeys(titres))[:maximum]
                fichiers = infos_fichiers(titres)
                print(f"{dossier} / {categorie} : {len(fichiers)} photos sous licence libre")
                for info in fichiers:
                    relatif = f"{dossier}/{nom_fichier(info['titre'])}"
                    if relatif in deja:
                        continue
                    requete = urllib.request.Request(info["url"], headers={"User-Agent": AGENT})
                    try:
                        with urllib.request.urlopen(requete, timeout=60) as r:
                            (dossier_brut / relatif).write_bytes(r.read())
                    except OSError as e:
                        print(f"  échec {info['titre']} : {e}")
                        continue
                    credits.writerow({
                        "fichier": relatif, "auteur": info["auteur"],
                        "licence": info["licence"], "page": info["page"],
                    })
                    deja.add(relatif)
                    time.sleep(PAUSE / 2)
    print(f"Terminé : {len(deja)} photos dans {dossier_brut}")


if __name__ == "__main__":
    import sys

    telecharger(Path(__file__).resolve().parent.parent / "donnees" / "brut", sys.argv[1:] or None)
