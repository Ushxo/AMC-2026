"""Service d'optimisation : écoute `demandes_optimisation`, calcule, écrit les tournées dans Supabase.

Lancement : uv run python -m optimisation.ecoute
Réglages dans data/.env.local (jamais dans le dépôt) : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
La clé de service n'est jamais affichée ni écrite dans un journal.

Realtime sert à réveiller la boucle ; l'interrogation toutes les 3 s garantit le traitement même si Realtime tombe.
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from optimisation.adaptateur import FUSEAU, vers_resultat
from optimisation.endroits import regrouper_ouverts
from optimisation.entrees import Donnees, heure_en_secondes
from optimisation.geometrie import ajouter_geometries
from optimisation.matrice_live import Cache, charger_cache, construire_matrices
from optimisation.modeles import Arret, Equipe, Incident, Lieu, Parametres, Probleme
from optimisation.solveur import resoudre

INTERVALLE_S = 3.0
INTERVENTION_S = 480  # hypothèse de démo, comme dans les précalculés
PENALITE_INCIDENT_S = {"accident": 600, "rue_fermee": 1800, "autre": 300}
LIMITE_MIN_S, LIMITE_MAX_S, LIMITE_DEFAUT_S = 1.0, 30.0, 8.0

MESSAGE_AUCUNE_EQUIPE = "Aucune équipe disponible pour cette période."
MESSAGE_AUCUN_ENDROIT = "Aucun signalement ouvert à planifier."
MESSAGE_SELECTION_FERMEE = "Aucun des endroits sélectionnés n'est encore ouvert."
MESSAGE_ECHEC = "Le calcul des tournées a échoué. Réessayez dans un instant."


class ErreurDemande(Exception):
    """Erreur dont le message est lisible tel quel par le superviseur."""


class FonctionAbsente(Exception):
    """Une fonction de la base (rpc) n'existe pas encore : la migration 0004 n'est pas lancée."""


class Magasin(Protocol):
    """Ce dont le service a besoin. L'implémentation réelle parle à Supabase ; les tests, à la mémoire."""

    def reserver_demande(self) -> dict[str, Any] | None: ...  # lève FonctionAbsente avant la 0003
    def demandes_en_attente(self) -> list[dict[str, Any]]: ...
    def marquer(self, demande_id: str, **champs: Any) -> None: ...
    def equipes_actives(self) -> list[dict[str, Any]]: ...
    def incidents_actifs(self) -> list[dict[str, Any]]: ...
    def signalements_ouverts(self) -> list[dict[str, Any]]: ...
    def publier(self, demande_id: str, resultat: dict[str, Any]) -> None: ...
    def mettre_a_jour_geometries(
        self, demande_id: str, geometries: dict[str, dict[str, Any]]
    ) -> None: ...


def maintenant_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _hhmm(v: str) -> str:
    return str(v)[:5]


def jour_du_prochain_quart(maintenant: datetime, debuts_s: list[int]) -> date:
    """On planifie toujours le PROCHAIN quart : aujourd'hui si l'heure de Montréal précède le début du
    premier quart, sinon demain. Une réoptimisation ne tombe ainsi jamais dans le passé."""
    local = maintenant.astimezone(FUSEAU)
    secondes = local.hour * 3600 + local.minute * 60 + local.second
    premier = min(debuts_s) if debuts_s else 0
    return local.date() if secondes < premier else local.date() + timedelta(days=1)


def _secondes_depuis_minuit(iso_str: str, jour: date) -> int | None:
    dt = datetime.fromisoformat(iso_str).astimezone(FUSEAU)
    if dt.date() != jour:
        return None
    return dt.hour * 3600 + dt.minute * 60 + dt.second


def construire_donnees(
    params: dict[str, Any],
    equipes_rows: list[dict[str, Any]],
    incidents_rows: list[dict[str, Any]],
    signalements: list[dict[str, Any]],
    cache: Cache | None,
    maintenant: datetime | None = None,
) -> tuple[Donnees, list[dict[str, Any]], date]:
    voulues = set(params.get("equipe_ids") or [])
    if params.get("date"):
        jour = date.fromisoformat(params["date"])
    else:
        debuts = [
            heure_en_secondes(_hhmm(e["debut_quart"]))
            for e in equipes_rows
            if not voulues or e["id"] in voulues
        ]
        jour = jour_du_prochain_quart(maintenant or datetime.now(UTC), debuts)
    plus_tot = (
        _secondes_depuis_minuit(params["debut_au_plus_tot"], jour)
        if params.get("debut_au_plus_tot")
        else None
    )
    equipes: list[Equipe] = []
    lieux: list[Lieu] = []
    for e in equipes_rows:
        if voulues and e["id"] not in voulues:
            continue
        debut = heure_en_secondes(_hhmm(e["debut_quart"]))
        fin = heure_en_secondes(_hhmm(e["fin_quart"]))
        if plus_tot is not None:
            debut = max(debut, plus_tot)
        if fin <= debut:
            continue  # quart déjà terminé
        garage = f"garage:{e['id']}"
        lieux.append(Lieu(garage, e["garage_latitude"], e["garage_longitude"]))
        equipes.append(Equipe(e["id"], e["nom"], garage, fin_s=fin, debut_s=debut))
    if not equipes:
        raise ErreurDemande(MESSAGE_AUCUNE_EQUIPE)

    seuil = int(params.get("seuil_apparition", 1))
    endroits = regrouper_ouverts(signalements, seuil)
    if not endroits:
        raise ErreurDemande(MESSAGE_AUCUN_ENDROIT)
    choisies = {c for c in (params.get("cles_endroits") or []) if isinstance(c, str)}
    if choisies:  # sélection du superviseur : clés inconnues ou déjà réglées ignorées
        endroits = [e for e in endroits if e.cle in choisies]
        if not endroits:
            raise ErreurDemande(MESSAGE_SELECTION_FERMEE)
    rang = {e.cle: i for i, e in enumerate(endroits)}  # déjà triés par plus ancien signalement
    ids_incidents = set(params.get("incident_ids") or [])
    incidents = [
        Incident(i["latitude"], i["longitude"], i["rayon_m"], PENALITE_INCIDENT_S[i["type"]])
        for i in incidents_rows
        if i.get("actif", True) and (not ids_incidents or i["id"] in ids_incidents)
    ]
    for e in endroits:
        lieu = Lieu(e.cle, e.latitude, e.longitude)
        i = cache.trouver(lieu) if cache else None
        if i is not None and e.cle.startswith("grille:"):
            # Le puisard du cache donne la position réelle de l'arrêt (celle de la matrice OSRM).
            lieu = Lieu(e.cle, cache.positions[i][0], cache.positions[i][1])
        lieux.append(lieu)
    temps, dist, pen, source = construire_matrices(lieux, cache)

    arrets = []
    for e in endroits:
        lieu_cache = cache.trouver(next(x for x in lieux if x.id == e.cle)) if cache else None
        supplement = (
            cache.penalite_arret_s.get(cache.ids[lieu_cache], 0)
            if cache and lieu_cache is not None
            else 0
        )
        arrets.append(
            Arret(
                e.cle, e.gravite, len(e.signalement_ids), rang[e.cle], INTERVENTION_S + supplement
            )
        )
    limite = min(
        LIMITE_MAX_S, max(LIMITE_MIN_S, float(params.get("limite_secondes") or LIMITE_DEFAUT_S))
    )
    probleme = Probleme(
        lieux=lieux,
        temps_s=temps,
        distance_m=dist,
        penalites_s=pen,
        arrets=arrets,
        equipes=equipes,
        incidents=incidents,
        parametres=Parametres(intervention_s=INTERVENTION_S, limite_s=limite),
    )
    donnees = Donnees(
        probleme,
        {e.cle: e.signalement_ids for e in endroits},
        source,
        {},
        prefixe_cle="",
    )
    incidents_contrat = [
        {
            "id": i["id"],
            "type": i["type"],
            "position": {"latitude": i["latitude"], "longitude": i["longitude"]},
            "rayon_m": i["rayon_m"],
            "simule": bool(i.get("simule", True)),
        }
        for i in incidents_rows
        if i.get("actif", True) and (not ids_incidents or i["id"] in ids_incidents)
    ]
    return donnees, incidents_contrat, jour


def traiter_demande(
    magasin: Magasin,
    demande: dict[str, Any],
    cache: Cache | None,
    utiliser_osrm: bool = True,
    journal=print,
    reservee: bool = False,
    traces_en_arriere_plan: bool = True,
) -> None:
    """Calcule une demande et la publie. En cas d'erreur, la demande passe à « echec » et l'ancien plan reste.

    `reservee` : la demande vient de reserver_demande (déjà « en_cours », réservée à ce service).
    """
    demande_id = demande["id"]
    if not reservee:
        magasin.marquer(demande_id, statut="en_cours", commence_le=maintenant_iso())
    chronos: dict[str, float] = {}
    t0 = time.perf_counter()

    def etape(nom: str) -> None:
        nonlocal t0
        maintenant = time.perf_counter()
        chronos[nom] = maintenant - t0
        t0 = maintenant

    try:
        equipes = magasin.equipes_actives()
        incidents_lus = magasin.incidents_actifs()
        signalements = magasin.signalements_ouverts()
        etape("lecture base")
        donnees, incidents, jour = construire_donnees(
            demande.get("parametres") or {}, equipes, incidents_lus, signalements, cache
        )
        etape("matrices")
        sortie = resoudre(donnees.probleme)
        etape("solveur")
        resultat = vers_resultat(
            sortie, donnees, jour, incidents, demande_id=demande_id, precalcule=False
        )
        # Une seule opération : anciennes tournées effacées, nouvelles écrites, demande terminée.
        # Si elle échoue, l'ancien plan reste visible.
        magasin.publier(demande_id, resultat)
        etape("publication")
        detail = ", ".join(f"{nom} {duree:.1f} s" for nom, duree in chronos.items())
        journal(
            f"Demande {demande_id} terminée ({len(resultat['tournees'])} tournées). Durées : {detail}."
        )
        if utiliser_osrm:
            lancer = _ajouter_traces_apres_publication
            args = (magasin, demande_id, sortie, donnees, journal)
            if traces_en_arriere_plan:
                # Les tracés prennent plusieurs secondes : le service peut déjà traiter la demande suivante.
                threading.Thread(target=lancer, args=args, daemon=True).start()
            else:
                lancer(*args)
    except ErreurDemande as e:
        magasin.marquer(demande_id, statut="echec", message=str(e), termine_le=maintenant_iso())
        journal(f"Demande {demande_id} : {e}")
    except Exception as e:  # noqa: BLE001 : le service ne doit jamais s'arrêter sur une demande
        magasin.marquer(
            demande_id, statut="echec", message=MESSAGE_ECHEC, termine_le=maintenant_iso()
        )
        # Jamais le détail de l'erreur : il pourrait citer une clé.
        journal(f"Demande {demande_id} : échec ({type(e).__name__}).")


def _ajouter_traces_apres_publication(
    magasin: Magasin, demande_id: str, sortie: dict[str, Any], donnees: Donnees, journal
) -> None:
    """Tracés routiers OSRM (lents : environ 1 s par tournée, limite du serveur public).

    Le résultat est déjà publié sans tracé (l'app relie alors les arrêts par des segments droits) ;
    les tracés arrivent ensuite et l'app les relit. Un échec ici ne change rien à la demande terminée.
    """
    debut = time.perf_counter()
    try:
        ajouter_geometries(sortie, donnees.probleme, True)
        geometries = {
            t["equipe_id"]: t["geometrie"]
            for t in sortie["tournees"]
            if t.get("geometrie_source") == "osrm" and t.get("geometrie")
        }
        if geometries:
            magasin.mettre_a_jour_geometries(demande_id, geometries)
        journal(
            f"Demande {demande_id} : {len(geometries)} tracés ajoutés en {time.perf_counter() - debut:.1f} s."
        )
    except Exception as e:  # noqa: BLE001
        journal(f"Demande {demande_id} : tracés non ajoutés ({type(e).__name__}).")


_signales: set[str] = set()
_taches: set[asyncio.Task[None]] = set()  # références des tâches de fond


def _signaler_une_fois(message: str, journal) -> None:
    if message not in _signales:
        _signales.add(message)
        journal(message)


def traiter_en_attente(
    magasin: Magasin, cache: Cache | None, utiliser_osrm: bool = True, journal=print
) -> int:
    """Réserve la demande en attente la plus récente (les plus anciennes sont remplacées) et la traite.

    Avec la migration 0004, la réservation est atomique : deux services ne prennent pas la même demande et
    une demande restée « en_cours » plus de deux minutes est reprise. Sans elle, ancien chemin ligne par ligne.
    """
    try:
        demande = magasin.reserver_demande()
    except FonctionAbsente:
        _signaler_une_fois(
            "reserver_demande n'existe pas encore (migration 0004 non lancée) : mode sans réservation atomique.",
            journal,
        )
        return _traiter_sans_reservation(magasin, cache, utiliser_osrm, journal)
    if demande is None:
        return 0
    traiter_demande(magasin, demande, cache, utiliser_osrm, journal, reservee=True)
    return 1


def _traiter_sans_reservation(
    magasin: Magasin, cache: Cache | None, utiliser_osrm: bool, journal
) -> int:
    attente = sorted(magasin.demandes_en_attente(), key=lambda d: d["cree_le"])
    if not attente:
        return 0
    *anciennes, recente = attente
    for d in anciennes:
        magasin.marquer(d["id"], statut="remplacee", termine_le=maintenant_iso())
    traiter_demande(magasin, recente, cache, utiliser_osrm, journal)
    return 1


# ---------- Supabase ----------


def _fonction_absente(erreur: Exception) -> bool:
    code = str(getattr(erreur, "code", "") or "")
    message = str(getattr(erreur, "message", "") or erreur)
    return code in ("PGRST202", "42883") or "Could not find the function" in message


class MagasinSupabase:
    def __init__(self, client: Any, journal=print) -> None:
        self.c = client
        self.journal = journal

    def reserver_demande(self) -> dict[str, Any] | None:
        try:
            lignes = self.c.rpc("reserver_demande").execute().data
        except Exception as e:
            if _fonction_absente(e):
                raise FonctionAbsente from e
            raise
        if isinstance(lignes, dict):
            return lignes
        return lignes[0] if lignes else None

    def publier(self, demande_id: str, resultat: dict[str, Any]) -> None:
        try:
            self.c.rpc(
                "publier_tournees",
                {
                    "p_demande": demande_id,
                    "p_tournees": resultat["tournees"],
                    "p_comparaison": resultat["comparaison"],
                    "p_non_servis": resultat["non_servis"],
                    "p_source_matrice": resultat["source_matrice"],
                },
            ).execute()
            return
        except Exception as e:
            if not _fonction_absente(e):
                raise
        _signaler_une_fois(
            "publier_tournees n'existe pas encore (migration 0004 non lancée) : écriture ligne par ligne.",
            self.journal,
        )
        self._publier_par_lignes(demande_id, resultat)

    def mettre_a_jour_geometries(
        self, demande_id: str, geometries: dict[str, dict[str, Any]]
    ) -> None:
        for equipe_id, geometrie in geometries.items():
            (
                self.c.table("tournees")
                .update({"geometrie": geometrie})
                .eq("demande_id", demande_id)
                .eq("equipe_id", equipe_id)
                .execute()
            )

    def _publier_par_lignes(self, demande_id: str, resultat: dict[str, Any]) -> None:
        self.supprimer_toutes_les_tournees()
        try:
            self.ecrire_tournees(demande_id, resultat)
        except Exception:
            self.supprimer_tournees(demande_id)
            raise
        self.marquer(
            demande_id,
            statut="terminee",
            message=None,
            termine_le=maintenant_iso(),
            comparaison=resultat["comparaison"],
            non_servis=resultat["non_servis"],
            source_matrice=resultat["source_matrice"],
        )

    def demandes_en_attente(self) -> list[dict[str, Any]]:
        return (
            self.c.table("demandes_optimisation")
            .select("*")
            .eq("statut", "en_attente")
            .execute()
            .data
        )

    def marquer(self, demande_id: str, **champs: Any) -> None:
        self.c.table("demandes_optimisation").update(champs).eq("id", demande_id).execute()

    def equipes_actives(self) -> list[dict[str, Any]]:
        return self.c.table("equipes").select("*").eq("active", True).execute().data

    def incidents_actifs(self) -> list[dict[str, Any]]:
        return self.c.table("incidents").select("*").eq("actif", True).execute().data

    def signalements_ouverts(self) -> list[dict[str, Any]]:
        return (
            self.c.table("signalements")
            .select("*")
            .in_("etat", ["nouveau", "pris_en_charge"])
            .limit(5000)
            .execute()
            .data
        )

    def ecrire_tournees(self, demande_id: str, resultat: dict[str, Any]) -> None:
        for t in resultat["tournees"]:
            ligne = (
                self.c.table("tournees")
                .insert(
                    {
                        "demande_id": demande_id,
                        "equipe_id": t["equipe_id"],
                        "distance_m": t["distance_m"],
                        "duree_s": t["duree_s"],
                        "debut_prevu": t["debut_prevu"],
                        "fin_prevue": t["fin_prevue"],
                        "geometrie": t["geometrie"],
                    }
                )
                .execute()
                .data[0]
            )
            if t["arrets"]:
                self.c.table("arrets").insert(
                    [
                        {
                            "tournee_id": ligne["id"],
                            "demande_id": demande_id,
                            "rang": a["rang"],
                            "cle_endroit": a["cle_endroit"],
                            "signalement_ids": a["signalement_ids"],
                            "latitude": a["position"]["latitude"],
                            "longitude": a["position"]["longitude"],
                            "arrivee_prevue": a["arrivee_prevue"],
                            "depart_prevu": a["depart_prevu"],
                        }
                        for a in t["arrets"]
                    ]
                ).execute()

    def supprimer_tournees(self, demande_id: str) -> None:
        self.c.table("tournees").delete().eq(
            "demande_id", demande_id
        ).execute()  # les arrêts suivent (cascade)

    def supprimer_toutes_les_tournees(self) -> None:
        # Supabase exige un filtre : on vise toutes les lignes (identifiants différents de l'uuid nul).
        self.c.table("tournees").delete().neq(
            "id", "00000000-0000-0000-0000-000000000000"
        ).execute()


@dataclass(frozen=True)
class Reglages:
    url: str
    cle: str = ""  # ne jamais afficher


def lire_reglages(dossier: Path | None = None) -> Reglages:
    from dotenv import load_dotenv

    load_dotenv((dossier or Path(__file__).resolve().parent.parent) / ".env.local")
    url = os.environ.get("SUPABASE_URL", "")
    cle = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        raise SystemExit(
            "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans data/.env.local."
        )
    return Reglages(url, cle)


def journaliser_etat_realtime(etat: Any, journal=print) -> None:
    """Dit si Realtime est vraiment connecté (état SUBSCRIBED), sinon que l'interrogation prend le relais."""
    nom = getattr(etat, "value", str(etat))
    if nom == "SUBSCRIBED":
        journal("Realtime connecté.")
    else:
        journal(f"Realtime indisponible ({nom}) : interrogation toutes les {INTERVALLE_S:.0f} s.")


async def _reveil_realtime(r: Reglages, reveil: asyncio.Event, journal) -> None:
    """Réveille la boucle à chaque nouvelle demande. En cas de panne, l'interrogation prend le relais."""
    try:
        from supabase import acreate_client

        client = await acreate_client(r.url, r.cle)
        canal = client.channel("demandes-optimisation")
        canal.on_postgres_changes(
            "INSERT", lambda _p: reveil.set(), table="demandes_optimisation", schema="public"
        )
        await canal.subscribe(lambda etat, _erreur: journaliser_etat_realtime(etat, journal))
        await asyncio.Event().wait()
    except Exception as e:  # noqa: BLE001
        journal(
            f"Realtime indisponible ({type(e).__name__}) : interrogation toutes les {INTERVALLE_S:.0f} s."
        )


async def boucle(magasin: Magasin, reglages: Reglages | None = None, journal=print) -> None:
    cache = charger_cache()
    reveil = asyncio.Event()
    if reglages is not None:
        # La référence est gardée : une tâche sans référence peut être détruite avant la fin.
        tache = asyncio.create_task(_reveil_realtime(reglages, reveil, journal))
        _taches.add(tache)
        tache.add_done_callback(_taches.discard)
    journal("Service d'optimisation démarré.")
    while True:
        try:
            await asyncio.to_thread(traiter_en_attente, magasin, cache, True, journal)
        except Exception as e:  # noqa: BLE001
            journal(f"Erreur de lecture ({type(e).__name__}) : nouvel essai bientôt.")
        try:
            await asyncio.wait_for(reveil.wait(), timeout=INTERVALLE_S)
        except TimeoutError:
            pass
        reveil.clear()


def main() -> None:
    from supabase import create_client

    r = lire_reglages()
    asyncio.run(boucle(MagasinSupabase(create_client(r.url, r.cle)), r))


if __name__ == "__main__":
    main()
