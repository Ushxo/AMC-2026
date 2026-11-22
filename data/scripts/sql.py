"""Requêtes SQL et téléchargements vers le portail de données ouvertes."""

import httpx

from scripts.portail import BASE_URL, USER_AGENT


def requete_sql(sql: str) -> list[dict]:
    """Lance une requête SQL (POST JSON) et rend les lignes."""
    reponse = httpx.post(
        BASE_URL + "datastore_search_sql",
        json={"sql": sql},
        headers={"User-Agent": USER_AGENT},
        timeout=120,
    )
    reponse.raise_for_status()
    return reponse.json()["result"]["records"]


def telecharger_json(url: str) -> dict:
    """Télécharge un fichier JSON ou GeoJSON de moins de quelques Mo."""
    reponse = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=120, follow_redirects=True)
    reponse.raise_for_status()
    return reponse.json()
