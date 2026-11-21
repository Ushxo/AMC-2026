"""Accès au portail de données ouvertes de Montréal (CKAN)."""

import httpx

BASE_URL = "https://donnees.montreal.ca/api/3/action/"
USER_AGENT = "hackathon-2026-donnees/0.1"


def corps_recherche(resource_id: str, filtres: dict | None = None, limite: int = 100) -> dict:
    """Construit le corps JSON d'une requête datastore_search."""
    corps: dict = {"resource_id": resource_id, "limit": limite}
    if filtres:
        corps["filters"] = filtres
    return corps


def rechercher(resource_id: str, filtres: dict | None = None, limite: int = 100) -> list[dict]:
    """Interroge un jeu de données. Les filtres passent en POST, sinon ils sont ignorés."""
    reponse = httpx.post(
        BASE_URL + "datastore_search",
        json=corps_recherche(resource_id, filtres, limite),
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    reponse.raise_for_status()
    return reponse.json()["result"]["records"]
