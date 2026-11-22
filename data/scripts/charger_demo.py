"""Charge les signalements d'exemple et les équipes de démo dans Supabase (clé de service).

À lancer seulement avec l'accord du propriétaire, une fois les migrations passées. L'adresse du
projet et la clé de service sont lues dans data/.env.local (variables SUPABASE_URL et
SUPABASE_SERVICE_ROLE_KEY). La clé n'est jamais affichée ni écrite ailleurs.

    uv run python -m scripts.charger_demo --a-blanc        # compte seulement, rien n'est envoyé
    uv run python -m scripts.charger_demo                  # charge sans doublon
    uv run python -m scripts.charger_demo --reinitialiser  # efface les exemples puis recharge
"""

import argparse
import json
import uuid
from pathlib import Path

import httpx

RACINE = Path(__file__).resolve().parent.parent
OUT = RACINE / "out"
ENV = RACINE / ".env.local"
ESPACE_EQUIPES = uuid.UUID("0d4f6a10-7a58-4c1c-8f0e-52a1c6e3b7d4")
TAILLE_LOT = 100

COLONNES_SIGNALEMENT = (
    "id",
    "cree_le",
    "latitude",
    "longitude",
    "categorie",
    "gravite",
    "commentaire",
    "photo_url",
    "grille_id",
    "etat",
    "etat_change_le",
    "exemple_demo",
)


def lire_env(chemin: Path = ENV) -> dict[str, str]:
    """Lit un fichier KEY=valeur. Ignore les lignes vides et les commentaires."""
    if not chemin.exists():
        raise SystemExit(f"Fichier introuvable : {chemin}")
    valeurs = {}
    for ligne in chemin.read_text("utf-8").splitlines():
        ligne = ligne.strip()
        if ligne and not ligne.startswith("#") and "=" in ligne:
            cle, valeur = ligne.split("=", 1)
            valeurs[cle.strip()] = valeur.strip().strip('"').strip("'")
    return valeurs


def lignes_signalements(signalements: list[dict], avec_photo_verifiee: bool = False) -> list[dict]:
    """Garde seulement les colonnes de la table (ni `origine` ni `en_attente`). Avec `avec_photo_verifiee`
    (colonne de la migration 0011 présente), les signalements de démo sont marqués « photo vérifiée »."""
    lignes = [{c: s[c] for c in COLONNES_SIGNALEMENT} for s in signalements]
    if avec_photo_verifiee:
        for ligne in lignes:
            ligne["photo_verifiee"] = True
    return lignes


def lignes_equipes(donnees: dict) -> list[dict]:
    """Équipes de démo au format de la table `equipes`. Identifiants UUID stables."""
    garages = {g["id"]: g for g in donnees["garages"]}
    return [
        {
            "id": str(uuid.uuid5(ESPACE_EQUIPES, e["id"])),
            "nom": e["nom"],
            "membres": [],
            "vehicule": e["vehicule"],
            "garage_nom": garages[e["garage_id"]]["nom"],
            "garage_latitude": garages[e["garage_id"]]["latitude"],
            "garage_longitude": garages[e["garage_id"]]["longitude"],
            "debut_quart": e["debut_quart"],
            "fin_quart": e["fin_quart"],
            "active": True,
            "exemple_demo": True,
        }
        for e in donnees["equipes"]
    ]


class Charge:
    def __init__(self, url: str, cle: str, client: httpx.Client | None = None):
        self.base = url.rstrip("/") + "/rest/v1/"
        self.client = client or httpx.Client(timeout=60)
        self.entetes = {"apikey": cle, "Authorization": f"Bearer {cle}"}

    def _verifier(self, reponse: httpx.Response, action: str) -> None:
        if reponse.status_code >= 300:
            # Seulement l'action et le statut : jamais le corps ni les en-têtes de la réponse.
            raise RuntimeError(f"{action} : HTTP {reponse.status_code}")

    def inserer(self, table: str, lignes: list[dict]) -> int:
        """Insère par lots. Un identifiant déjà présent est ignoré (aucun doublon)."""
        entetes = {
            **self.entetes,
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        }
        for i in range(0, len(lignes), TAILLE_LOT):
            reponse = self.client.post(
                self.base + table,
                params={"on_conflict": "id"},
                headers=entetes,
                content=json.dumps(lignes[i : i + TAILLE_LOT]),
            )
            self._verifier(reponse, f"insertion dans {table}")
        return len(lignes)

    def effacer_exemples(self, table: str) -> None:
        reponse = self.client.delete(
            self.base + table,
            params={"exemple_demo": "eq.true"},
            headers={**self.entetes, "Prefer": "return=minimal"},
        )
        self._verifier(reponse, f"effacement dans {table}")

    def colonne_existe(self, table: str, colonne: str) -> bool:
        """Vrai si la colonne existe (une lecture vide, sans effet) : le chargement marche avec ou sans une migration."""
        reponse = self.client.get(
            self.base + table, params={"select": colonne, "limit": "0"}, headers=self.entetes
        )
        return reponse.status_code < 300

    def compter_exemples(self, table: str) -> int:
        reponse = self.client.get(
            self.base + table,
            params={"exemple_demo": "eq.true", "select": "id"},
            headers={**self.entetes, "Prefer": "count=exact", "Range": "0-0"},
        )
        self._verifier(reponse, f"comptage dans {table}")
        return int(reponse.headers["content-range"].rsplit("/", 1)[-1])


def charger(charge: Charge, signalements: list[dict], equipes: dict, reinitialiser: bool) -> dict:
    if reinitialiser:
        # Les tournées et leurs arrêts partent avec les équipes (suppression en cascade).
        charge.effacer_exemples("signalements")
        charge.effacer_exemples("equipes")
    charge.inserer("equipes", lignes_equipes(equipes))
    avec_photo = charge.colonne_existe("signalements", "photo_verifiee")
    charge.inserer("signalements", lignes_signalements(signalements, avec_photo))
    return {
        "signalements": charge.compter_exemples("signalements"),
        "equipes": charge.compter_exemples("equipes"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--a-blanc", action="store_true", help="compter sans rien envoyer")
    parser.add_argument("--reinitialiser", action="store_true", help="effacer les exemples d'abord")
    args = parser.parse_args()
    signalements = json.loads((OUT / "signalements-demo.json").read_text("utf-8"))
    equipes = json.loads((OUT / "equipes-demo.json").read_text("utf-8"))
    if args.a_blanc:
        print(f"À charger : {len(signalements)} signalements, {len(equipes['equipes'])} équipes.")
        return
    env = lire_env()
    charge = Charge(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    total = charger(charge, signalements, equipes, args.reinitialiser)
    print(
        f"Dans la base : {total['signalements']} signalements et {total['equipes']} équipes d'exemple."
    )


if __name__ == "__main__":
    main()
