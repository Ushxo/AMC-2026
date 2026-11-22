"""Tracé des tournées : OSRM (service route), avec repli sur des segments droits."""

from __future__ import annotations

import time
from typing import Any

import httpx

from optimisation.modeles import Probleme

URL_ROUTE = "https://router.project-osrm.org/route/v1/driving/"
USER_AGENT = "signalement-mtl-hackathon/1.0 (optimisation des tournees)"
TAILLE_BLOC = 90  # le serveur public limite le nombre de points par requête
PAUSE_S = 1.1  # au plus une requête par seconde


def _droite(coords: list[list[float]]) -> dict[str, Any]:
    return {"type": "LineString", "coordinates": coords}


def _route_osrm(client: httpx.Client, coords: list[list[float]]) -> list[list[float]]:
    chemin = ";".join(f"{lng:.6f},{lat:.6f}" for lng, lat in coords)
    r = client.get(f"{URL_ROUTE}{chemin}", params={"overview": "full", "geometries": "geojson"})
    r.raise_for_status()
    corps = r.json()
    if corps.get("code") != "Ok" or not corps.get("routes"):
        raise ValueError("OSRM n'a pas trouvé de route.")
    return corps["routes"][0]["geometry"]["coordinates"]


def geometrie_tournee(
    coords: list[list[float]], client: httpx.Client | None
) -> tuple[dict[str, Any], str]:
    """Rend (géométrie GeoJSON, source) où source vaut « osrm » ou « droite »."""
    if client is None or len(coords) < 2:
        return _droite(coords), "droite"
    try:
        trace: list[list[float]] = []
        for debut in range(0, len(coords) - 1, TAILLE_BLOC - 1):
            bloc = coords[debut : debut + TAILLE_BLOC]
            if len(bloc) < 2:
                break
            if debut:
                time.sleep(PAUSE_S)
            morceau = _route_osrm(client, bloc)
            trace.extend(morceau if not trace else morceau[1:])
        return {"type": "LineString", "coordinates": trace}, "osrm"
    except (httpx.HTTPError, ValueError, KeyError):
        return _droite(coords), "droite"


def ajouter_geometries(
    resultat: dict[str, Any], p: Probleme, utiliser_osrm: bool = True
) -> dict[str, Any]:
    """Ajoute à chaque tournée `geometrie` et `geometrie_source`. Ne plante jamais si OSRM ne répond pas."""
    position = {l.id: [l.longitude, l.latitude] for l in p.lieux}
    client = (
        httpx.Client(timeout=8.0, headers={"User-Agent": USER_AGENT}) if utiliser_osrm else None
    )
    try:
        for t in resultat["tournees"]:
            coords = [position[i] for i in t["lieux"]]
            t["geometrie"], t["geometrie_source"] = geometrie_tournee(coords, client)
            if client is not None:
                time.sleep(PAUSE_S)
    finally:
        if client is not None:
            client.close()
    return resultat
