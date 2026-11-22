"""Matrices pour un problème quelconque : cache OSRM de Data pour les paires connues, sinon vol d'oiseau."""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from optimisation.entrees import OUT
from optimisation.incident import penalites_incident
from optimisation.modeles import Incident, Lieu

DETOUR = 1.3
VITESSE_VOL_OISEAU_KMH = 20.0  # valeur du contrat
TOLERANCE_DEG = 2e-5  # deux positions plus proches que cela sont le même lieu (environ 2 m)


def vol_oiseau_m(a: Lieu, b: Lieu) -> float:
    p1, p2 = math.radians(a.latitude), math.radians(b.latitude)
    dl = math.radians(b.longitude - a.longitude)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


@dataclass(frozen=True)
class Cache:
    ids: list[str]
    positions: list[tuple[float, float]]
    temps_s: list[list[int]]
    distance_m: list[list[int]]
    permis: list[dict[str, Any]]
    rayon_m: float
    plafond_s: int
    penalite_arret_s: dict[str, int]
    source: str
    index: dict[str, int] = field(default_factory=dict)

    def trouver(self, lieu: Lieu) -> int | None:
        # Un endroit « grille:<id> » est le puisard de même identifiant dans le cache (la position moyenne
        # des signalements est proche du puisard mais pas identique) ; les garages se reconnaissent à leur position.
        i = self.index.get(lieu.id.removeprefix("grille:"))
        if i is not None:
            return i
        for i, (lat, lng) in enumerate(self.positions):
            if (
                abs(lat - lieu.latitude) <= TOLERANCE_DEG
                and abs(lng - lieu.longitude) <= TOLERANCE_DEG
            ):
                return i
        return None


def charger_cache(dossier: Path = OUT) -> Cache | None:
    try:
        m = json.loads((dossier / "matrice.json").read_text(encoding="utf-8"))
        p = json.loads((dossier / "penalites.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    regle = p.get("regle", {})
    return Cache(
        ids=[x["id"] for x in m["points"]],
        positions=[(x["latitude"], x["longitude"]) for x in m["points"]],
        temps_s=m["durees_s"],
        distance_m=m["distances_m"],
        permis=p.get("permis", []),
        rayon_m=float(regle.get("rayon_m", 30)),
        plafond_s=int(regle.get("plafond_paire_s", 600)),
        penalite_arret_s={k: int(v) for k, v in p.get("penalite_arret_s", {}).items()},
        source=m.get("source", "osrm"),
        index={x["id"]: i for i, x in enumerate(m["points"])},
    )


URL_TABLE = "https://router.project-osrm.org/table/v1/driving/"
USER_AGENT = "signalement-mtl-hackathon/1.0 (optimisation des tournees)"
MAX_COORDONNEES = 100  # limite du serveur public par requête
DELAI_MAX_S = (
    3.0  # temps total accordé à la complétion par OSRM : au-delà, on garde le vol d'oiseau
)
ECART_REQUETES_S = 1.05  # au plus une requête par seconde (d'un départ de requête au suivant)
MEMOIRE_MAX = 200_000

# Trajets déjà obtenus d'OSRM, gardés en mémoire du service (jamais écrits dans le dépôt ni dans
# data/out) pour ne pas les redemander à la demande suivante. Clé : (lieu de départ, lieu d'arrivée)
# par coordonnées arrondies à 6 décimales ; valeur : (durée en s, distance en m).
_MEMOIRE: dict[tuple[tuple[float, float], tuple[float, float]], tuple[int, int]] = {}


def vider_memoire() -> None:
    _MEMOIRE.clear()


def _cle(lieu: Lieu) -> tuple[float, float]:
    return (round(lieu.latitude, 6), round(lieu.longitude, 6))


def _table_osrm(
    client: httpx.Client, coords: list[Lieu], delai_s: float | None = None
) -> dict[str, Any] | None:
    """Table OSRM de toutes les coordonnées vers toutes (durées et distances), ou None si le serveur échoue."""
    chemin = ";".join(f"{c.longitude:.6f},{c.latitude:.6f}" for c in coords)
    try:
        r = client.get(
            f"{URL_TABLE}{chemin}",
            params={"annotations": "duration,distance"},
            timeout=delai_s if delai_s is not None else httpx.USE_CLIENT_DEFAULT,
        )
        corps = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    if r.status_code != 200 or corps.get("code") != "Ok":
        return None
    return corps


def completer_osrm(
    lieux: list[Lieu],
    temps: list[list[int]],
    dist: list[list[int]],
    lignes: list[int],
    colonnes: list[int],
    client: httpx.Client,
    delai_max_s: float = DELAI_MAX_S,
    ecart_s: float = ECART_REQUETES_S,
    memoire: dict | None = None,
) -> tuple[int, set[tuple[int, int]]]:
    """Remplace par des valeurs OSRM les trajets manquants : ceux qui partent des lieux `lignes` vers tous
    les autres, et ceux qui arrivent aux lieux `colonnes` depuis tous les autres (lieux hors du cache).

    Les trajets déjà obtenus sont repris de la mémoire du service. Le reste vient d'OSRM par blocs de
    100 coordonnées au plus (les nouveaux lieux et un bloc des autres, un tableau complet par requête),
    une requête par seconde au plus et au plus `delai_max_s` au total ; au-delà, ce qui manque garde
    sa valeur à vol d'oiseau. Rend (nombre de requêtes, cases remplacées)."""
    memoire = _MEMOIRE if memoire is None else memoire
    n = len(lieux)
    besoin = {(u, j) for u in lignes for j in range(n) if j != u}
    besoin |= {(i, u) for u in colonnes for i in range(n) if i != u}
    remplacees: set[tuple[int, int]] = set()
    for i, j in besoin:
        trouve = memoire.get((_cle(lieux[i]), _cle(lieux[j])))
        if trouve is not None:
            temps[i][j], dist[i][j] = trouve
            remplacees.add((i, j))
    manquantes = besoin - remplacees
    nouveaux = sorted(set(lignes) | set(colonnes))
    if not manquantes or len(nouveaux) >= MAX_COORDONNEES:
        return 0, remplacees
    ensemble_nouveaux = set(nouveaux)
    autres = [k for k in range(n) if k not in ensemble_nouveaux]
    taille = MAX_COORDONNEES - len(nouveaux)
    debut = time.monotonic()
    dernier_depart: float | None = None
    requetes = 0
    for k in range(0, max(len(autres), 1), taille):
        bloc = autres[k : k + taille]
        ensemble_bloc = set(bloc)
        utiles = [
            (i, j)
            for i, j in manquantes
            if i in ensemble_bloc
            or j in ensemble_bloc
            or (k == 0 and i in ensemble_nouveaux and j in ensemble_nouveaux)
        ]
        if not utiles:
            continue
        if dernier_depart is not None:
            attente = ecart_s - (time.monotonic() - dernier_depart)
            if attente > 0:
                if time.monotonic() + attente - debut >= delai_max_s:
                    break  # plus de temps pour une autre requête
                time.sleep(attente)
        restant = delai_max_s - (time.monotonic() - debut)
        if restant <= 0.1:
            break
        dernier_depart = time.monotonic()
        requetes += 1
        indices = [*nouveaux, *bloc]
        reponse = _table_osrm(client, [lieux[i] for i in indices], restant)
        if reponse is None:
            continue
        position = {indice: rang for rang, indice in enumerate(indices)}
        for i, j in utiles:
            d = reponse["durations"][position[i]][position[j]]
            m = reponse["distances"][position[i]][position[j]]
            if d is None or m is None:
                continue
            temps[i][j], dist[i][j] = round(d), round(m)
            remplacees.add((i, j))
            if len(memoire) < MEMOIRE_MAX:
                memoire[(_cle(lieux[i]), _cle(lieux[j]))] = (round(d), round(m))
    return requetes, remplacees


def construire_matrices(
    lieux: list[Lieu],
    cache: Cache | None,
    client: httpx.Client | None = None,
    departs: list[int] | None = None,
    fins: list[int] | None = None,
) -> tuple[list[list[int]], list[list[int]], list[list[int]], str]:
    """Rend (temps_s, distance_m, penalites_chantiers_s, source). Source « vol_oiseau » si au moins une paire
    est estimée à vol d'oiseau.

    Les lieux qui ne sont pas dans le cache (nouveaux endroits, départs à la position d'une équipe, endroit
    de fin) reçoivent leurs trajets d'OSRM (service `table`) quand un `client` est donné : seulement les lignes
    et colonnes qui manquent. `departs` et `fins` sont des indices de lieux : un départ n'a besoin que de sa
    ligne, une fin que de sa colonne."""
    n = len(lieux)
    ref = [cache.trouver(l) if cache else None for l in lieux]
    temps = [[0] * n for _ in range(n)]
    dist = [[0] * n for _ in range(n)]
    vol_cases: set[tuple[int, int]] = set()
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if ref[i] is not None and ref[j] is not None:
                temps[i][j] = int(cache.temps_s[ref[i]][ref[j]])
                dist[i][j] = int(cache.distance_m[ref[i]][ref[j]])
            else:
                vol_cases.add((i, j))
                d = vol_oiseau_m(lieux[i], lieux[j]) * DETOUR
                dist[i][j] = round(d)
                temps[i][j] = round(d / (VITESSE_VOL_OISEAU_KMH / 3.6))
    osrm_utilise = False
    if client is not None and vol_cases:
        hors_cache = [i for i in range(n) if ref[i] is None]
        seulement_departs = set(departs or []) - set(fins or [])
        seulement_fins = set(fins or []) - set(departs or [])
        lignes = [i for i in hors_cache if i not in seulement_fins]
        colonnes = [i for i in hors_cache if i not in seulement_departs]
        if lignes or colonnes:
            osrm_utilise = True
            _, remplacees = completer_osrm(lieux, temps, dist, lignes, colonnes, client)
            vol_cases -= remplacees
            # Personne n'arrive à un départ ni ne repart d'une fin : ces cases ne servent jamais.
            vol_cases = {
                (i, j)
                for i, j in vol_cases
                if j not in seulement_departs and i not in seulement_fins
            }
    vol = bool(vol_cases)
    pen = [[0] * n for _ in range(n)]
    if cache:
        for permis in cache.permis:
            if not permis.get("penalite_s"):
                continue
            zone = Incident(
                permis["latitude"], permis["longitude"], cache.rayon_m, int(permis["penalite_s"])
            )
            une = penalites_incident(lieux, [zone])
            for i in range(n):
                for j in range(n):
                    pen[i][j] = min(cache.plafond_s, pen[i][j] + une[i][j])
    if vol:
        source = "vol_oiseau"
    elif cache and cache.source == "osrm":
        source = "osrm_cache"  # le cache d'OSRM, complété au besoin par OSRM
    else:
        source = "osrm" if osrm_utilise else "vol_oiseau"
    return temps, dist, pen, source
