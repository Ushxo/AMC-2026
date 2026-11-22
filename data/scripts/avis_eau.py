"""Avis liés à l'eau (ébullition, coupure) vers data/out/avis-eau.geojson."""

import hashlib
import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

from shapely.geometry import LineString, box, mapping, shape

from scripts import quartier
from scripts.sql import requete_sql, telecharger_json

RESSOURCE_CSV = "fc6e5f85-7eba-451c-8243-bdf35c2ab336"
RESSOURCE_GEOJSON = "d249e452-46f5-422f-91ae-898c98eea6cc"
URL_GEOJSON = (
    "https://donnees.montreal.ca/dataset/556c84af-aebf-4ca9-9a9c-2f246601674c/resource/"
    f"{RESSOURCE_GEOJSON}/download/avis-alertes.geojson"
)
SORTIE = Path(__file__).resolve().parent.parent / "out" / "avis-eau.geojson"
ADRESSES = SORTIE.parent / "adresses.json"

# Un avis (coupure ou ébullition) plus vieux que cette durée est considéré terminé.
JOURS_MAX = 45
RAYON_TAMPON_M = 30
BOITE = (45.40, 45.71, -73.98, -73.47)


def sans_accent(texte: str) -> str:
    base = unicodedata.normalize("NFD", texte.lower().replace("’", "'"))
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def est_fin(titre: str) -> bool:
    return sans_accent(titre).startswith("fin ")


def type_avis(titre: str, type_portail: str) -> str | None:
    t = sans_accent(titre)
    if "ebullition" in t or "bouillir" in t:
        return "ebullition"
    if type_portail == "Eau et aqueduc" and re.search(r"coupure|interruption", t):
        return "coupure"
    return None


def lieu(titre: str) -> str:
    """Partie du titre qui décrit l'endroit, sans l'arrondissement."""
    t = sans_accent(titre)
    t = t.split(" - ", 1)[-1] if " – " not in t and " - " in t else t.split(" – ", 1)[-1]
    t = re.split(r"[,–-]\s*(?:arrondissement|ville-marie|plateau|sud-ouest)", t)[0]
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def tampon(ligne: LineString):
    """Polygone d'environ 30 m de part et d'autre d'une ligne."""
    d_lat = RAYON_TAMPON_M / 111_000
    d_lng = RAYON_TAMPON_M / 78_000
    facteur = d_lat / d_lng
    mise_echelle = LineString([(x * facteur, y) for x, y in ligne.coords])
    poly = mise_echelle.buffer(d_lat, quad_segs=2)
    coords = [(round(x / facteur, 6), round(y, 6)) for x, y in poly.exterior.coords]
    return {"type": "Polygon", "coordinates": [[list(c) for c in coords]]}


def geometrie(g: dict | None) -> dict | None:
    if not g:
        return None
    if g["type"] == "Point":
        lng, lat = g["coordinates"][:2]
        return {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}
    if g["type"] == "LineString":
        return tampon(shape(g))
    if g["type"] in ("Polygon", "MultiPolygon"):
        return mapping(shape(g).simplify(0.00002))
    return None


def dans_montreal(g: dict | None) -> bool:
    """Vrai si toute la géométrie (tous types) est dans la boîte de Montréal."""
    if not g:
        return False
    x_min, y_min, x_max, y_max = shape(g).bounds
    return BOITE[0] <= y_min and y_max <= BOITE[1] and BOITE[2] <= x_min and x_max <= BOITE[3]


MARGE_LAT = 0.009
MARGE_LNG = 0.013


def touche_quartier(g: dict) -> bool:
    """Vrai si la géométrie (tous types) touche la boîte de démo élargie d'environ 1 km."""
    zone = box(
        quartier.LNG_MIN - MARGE_LNG,
        quartier.LAT_MIN - MARGE_LAT,
        quartier.LNG_MAX + MARGE_LNG,
        quartier.LAT_MAX + MARGE_LAT,
    )
    return shape(g).intersects(zone)


def adresse_du_titre(titre: str, adresses: list[dict]) -> dict | None:
    t = re.sub(r"[^a-z0-9]+", " ", sans_accent(titre))
    for a in adresses:
        cle = re.sub(r"[^a-z0-9]+", " ", sans_accent(a["libelle"])).strip()
        if re.match(r"\d", cle) and f" {cle} " in f" {t} ":
            return a
    return None


def ids_csv() -> dict[tuple[str, str], str]:
    """Identifiant `_id` du CSV pour chaque couple (titre, date de début)."""
    lignes = requete_sql(f'SELECT "_id","titre","date_debut" FROM "{RESSOURCE_CSV}" LIMIT 32000')
    return {(r["titre"].strip(), r["date_debut"]): str(r["_id"]) for r in lignes}


def construire(
    source: dict,
    adresses: list[dict],
    aujourdhui: date | None = None,
    ids: dict[tuple[str, str], str] | None = None,
) -> dict:
    """Filtre, place et classe les avis d'eau. `source` est le GeoJSON du jeu."""
    aujourdhui = aujourdhui or date.today()
    candidats = []
    for f in source["features"]:
        p = f["properties"]
        titre = (p.get("titre") or "").strip()
        genre = type_avis(titre, p.get("type") or "")
        if not genre or not p.get("date_debut"):
            continue
        candidats.append((f, p, titre, genre))

    # Fermetures : un avis « Fin de l'avis ... ébullition » ferme les ébullitions plus anciennes
    # du même endroit (même lieu dans le titre, ou même géométrie).
    fins = [
        (p["date_debut"], lieu(t), f["geometry"])
        for f, p, t, g in candidats
        if g == "ebullition" and est_fin(t)
    ]

    def ferme(p: dict, titre: str, geom: dict | None) -> bool:
        return any(
            d > p["date_debut"] and (l == lieu(titre) or (geom and geom == gf)) for d, l, gf in fins
        )

    features = []
    for f, p, titre, genre in candidats:
        if est_fin(titre):
            continue
        debut = datetime.fromisoformat(p["date_debut"]).date()
        if genre == "ebullition" and ferme(p, titre, f["geometry"]):
            continue
        # Limite d'âge choisie par l'équipe, pas une donnée de la Ville.
        if debut < aujourdhui - timedelta(days=JOURS_MAX):
            continue
        geom = geometrie(f["geometry"])
        adresse = adresse_du_titre(titre, adresses)
        placement = "geometrie_source"
        if geom is not None and not touche_quartier(geom):
            continue
        if geom is None or not dans_montreal(geom):
            if adresse:
                geom = {"type": "Point", "coordinates": [adresse["longitude"], adresse["latitude"]]}
                placement = "adresse"
            else:
                geom, placement = None, "aucun"
        identifiant = (ids or {}).get((titre, p["date_debut"])) or hashlib.sha1(
            f"{titre}|{p['date_debut']}".encode()
        ).hexdigest()[:12]
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "id": identifiant,
                    "origine": "officiel",
                    "gravite": "elevee" if genre == "ebullition" else "moyenne",
                    "type": genre,
                    "titre": titre,
                    "adresse": adresse["libelle"] if adresse else None,
                    "debut": p["date_debut"],
                    "fin": None,
                    "placement": placement,
                },
            }
        )
    uniques = {f["properties"]["id"]: f for f in features}
    return {"type": "FeatureCollection", "features": list(uniques.values())}


def main() -> None:
    source = telecharger_json(URL_GEOJSON)
    adresses = json.loads(ADRESSES.read_text("utf-8")) if ADRESSES.exists() else []
    donnees = construire(source, adresses, ids=ids_csv())
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{len(donnees['features'])} avis écrits dans {SORTIE}")


if __name__ == "__main__":
    main()
