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

import httpx

from optimisation.adaptateur import FUSEAU, vers_resultat
from optimisation.endroits import regrouper_ouverts
from optimisation.entrees import Donnees, heure_en_secondes
from optimisation.geometrie import ajouter_geometries
from optimisation.matrice_live import USER_AGENT as USER_AGENT_OSRM
from optimisation.matrice_live import Cache, charger_cache, construire_matrices
from optimisation.modeles import Arret, Equipe, Incident, Lieu, Parametres, Probleme
from optimisation.plan_partiel import cles_a_exclure, details_de, fusionner
from optimisation.solveur import resoudre

INTERVALLE_S = 3.0
INTERVENTION_S = 480  # hypothèse de démo, comme dans les précalculés
PENALITE_INCIDENT_S = {"accident": 600, "rue_fermee": 1800, "autre": 300}
LIMITE_MIN_S, LIMITE_MAX_S, LIMITE_DEFAUT_S = 1.0, 30.0, 8.0

MESSAGE_AUCUNE_EQUIPE = "Aucune équipe disponible pour cette période."
MESSAGE_AUCUN_ENDROIT = "Aucun signalement ouvert à planifier."
MESSAGE_SELECTION_FERMEE = "Aucun des endroits sélectionnés n'est encore ouvert."
MESSAGE_ECHEC = "Le calcul des tournées a échoué. Réessayez dans un instant."
MESSAGE_FIN_MANQUANTE = "Choisissez l'endroit où les équipes finissent leur tournée."
MESSAGE_FIN_INTROUVABLE = "L'endroit de fin choisi est introuvable."
MESSAGE_FIN_INCONNUE = "Cette façon de finir la tournée n'existe pas."
MESSAGE_RIEN_A_REPLANIFIER = "Il ne reste aucun arrêt à replanifier pour cette équipe."
MESSAGE_DEPART_INCONNU = "Cette façon de partir n'existe pas."
MESSAGE_RECALCUL_INCONNU = "Ce type de recalcul n'existe pas."
MESSAGE_RECALCUL_SANS_EQUIPE = "Choisissez l'équipe dont il faut recalculer la tournée."

# Une position d'équipe plus vieille que cela n'est plus fiable : l'équipe part de son garage.
AGE_MAX_POSITION_S = 15 * 60


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
    # Dernières positions connues des équipes (table positions_equipes) ; appelé seulement quand une
    # demande part de la position des équipes.
    def positions_equipes(self) -> list[dict[str, Any]]: ...
    # Plan en place : lignes de `tournees` avec leurs `arrets` ; appelé seulement pour un recalcul partiel.
    def tournees_en_place(self) -> list[dict[str, Any]]: ...
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


def position_fraiche(
    positions: list[dict[str, Any]] | None, equipe_id: str, maintenant: datetime
) -> tuple[float, float] | None:
    """Dernière position connue de l'équipe si elle a moins de 15 minutes, sinon None."""
    lignes = [p for p in positions or [] if p.get("equipe_id") == equipe_id]
    if not lignes:
        return None
    try:
        derniere = max(lignes, key=lambda p: datetime.fromisoformat(str(p["maj_le"])).timestamp())
        quand = datetime.fromisoformat(str(derniere["maj_le"]))
        if quand.tzinfo is None:
            quand = quand.replace(tzinfo=UTC)
        age = (maintenant - quand).total_seconds()
        coordonnees = (float(derniere["latitude"]), float(derniere["longitude"]))
    except (KeyError, ValueError, TypeError):
        return None
    return coordonnees if -60 <= age <= AGE_MAX_POSITION_S else None


def _selection_partielle(parametres: dict[str, Any], signalements: list[dict[str, Any]]) -> bool:
    """Vrai si le superviseur a choisi moins d'endroits que ceux qui sont ouverts."""
    choisies = {c for c in (parametres.get("cles_endroits") or []) if isinstance(c, str)}
    if not choisies:
        return False
    seuil = int(parametres.get("seuil_apparition", 1))
    ouverts = {e.cle for e in regrouper_ouverts(signalements, seuil)}
    return bool(ouverts - choisies)


def _position_endroit_fin(
    cle: str, tous_les_endroits: list, cache: Cache | None
) -> tuple[float, float] | None:
    """Coordonnées de l'endroit de fin : un endroit ouvert, un puisard connu ou une case."""
    for e in tous_les_endroits:
        if e.cle == cle:
            if cache is not None and cle.startswith("grille:"):
                i = cache.index.get(cle.removeprefix("grille:"))
                if i is not None:
                    return cache.positions[i]
            return (e.latitude, e.longitude)
    if cache is not None and cle.startswith("grille:"):
        i = cache.index.get(cle.removeprefix("grille:"))
        if i is not None:
            return cache.positions[i]
    if cle.startswith("case:"):
        try:
            _, lat, lng = cle.split(":")
            return (float(lat), float(lng))
        except ValueError:
            return None
    return None


def construire_donnees(
    params: dict[str, Any],
    equipes_rows: list[dict[str, Any]],
    incidents_rows: list[dict[str, Any]],
    signalements: list[dict[str, Any]],
    cache: Cache | None,
    maintenant: datetime | None = None,
    positions: list[dict[str, Any]] | None = None,
    client_osrm: Any = None,
    exclure_cles: set[str] | None = None,
    fin_position_defaut: tuple[float, float] | None = None,
) -> tuple[Donnees, list[dict[str, Any]], date]:
    maintenant = maintenant or datetime.now(UTC)
    voulues = set(params.get("equipe_ids") or [])
    depart_mode = params.get("depart") or "garage"
    fin_mode = params.get("fin") or "garage"
    depart_par_equipe = params.get("depart_par_equipe") or {}
    fin_par_equipe = params.get("fin_par_equipe") or {}
    if fin_mode not in ("garage", "libre", "endroit"):
        raise ErreurDemande(MESSAGE_FIN_INCONNUE)
    if depart_mode not in ("garage", "position") or any(
        v not in ("garage", "position") for v in depart_par_equipe.values()
    ):
        raise ErreurDemande(MESSAGE_DEPART_INCONNU)
    if any(v not in ("garage", "arrivee", "libre") for v in fin_par_equipe.values()):
        raise ErreurDemande(MESSAGE_FIN_INCONNUE)
    if params.get("date"):
        jour = date.fromisoformat(params["date"])
    else:
        debuts = [
            heure_en_secondes(_hhmm(e["debut_quart"]))
            for e in equipes_rows
            if not voulues or e["id"] in voulues
        ]
        jour = jour_du_prochain_quart(maintenant, debuts)
    plus_tot = (
        _secondes_depuis_minuit(params["debut_au_plus_tot"], jour)
        if params.get("debut_au_plus_tot")
        else None
    )
    equipes: list[Equipe] = []
    lieux: list[Lieu] = []
    lieux_departs: list[Lieu] = []
    lieux_arrivees: list[Lieu] = []
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
        depart = None
        if depart_par_equipe.get(e["id"], depart_mode) == "position":
            position = position_fraiche(positions, e["id"], maintenant)
            if position is not None:  # sinon (position absente ou périmée) : le garage
                depart = f"depart:{e['id']}"
                lieux_departs.append(Lieu(depart, position[0], position[1]))
        choix_fin = fin_par_equipe.get(e["id"])
        fin_equipe, fin_lieu_equipe, fin_nom = choix_fin, None, None
        if choix_fin == "arrivee":
            lat, lng = e.get("arrivee_latitude"), e.get("arrivee_longitude")
            if lat is not None and lng is not None:
                fin_lieu_equipe = f"arrivee:{e['id']}"
                fin_nom = e.get("arrivee_nom") or e.get("arrivee_adresse")
                lieux_arrivees.append(Lieu(fin_lieu_equipe, float(lat), float(lng)))
            else:  # pas d'adresse d'arrivée (ou migration 0007 non lancée) : le garage
                fin_equipe = "garage"
        equipes.append(
            Equipe(
                e["id"],
                e["nom"],
                garage,
                fin_s=fin,
                debut_s=debut,
                depart=depart,
                fin=fin_equipe,
                fin_lieu=fin_lieu_equipe,
                fin_nom=fin_nom,
            )
        )
    if not equipes:
        raise ErreurDemande(MESSAGE_AUCUNE_EQUIPE)

    seuil = int(params.get("seuil_apparition", 1))
    endroits = regrouper_ouverts(signalements, seuil)
    if not endroits:
        raise ErreurDemande(MESSAGE_AUCUN_ENDROIT)
    tous_les_endroits = endroits
    if (
        exclure_cles
    ):  # recalcul partiel : les endroits des autres équipes et ceux déjà faits restent en place
        endroits = [e for e in endroits if e.cle not in exclure_cles]
        if not endroits:
            raise ErreurDemande(MESSAGE_RIEN_A_REPLANIFIER)
    lieu_fin: Lieu | None = None
    if (
        fin_mode == "endroit"
        and fin_position_defaut is not None
        and not params.get("fin_cle_endroit")
    ):
        # Recalcul d'une tournée sans fin demandée : la fin de la tournée en place (sa position).
        lieu_fin = Lieu("fin:tournee", fin_position_defaut[0], fin_position_defaut[1])
    elif fin_mode == "endroit":
        cle_fin = params.get("fin_cle_endroit")
        if not isinstance(cle_fin, str) or not cle_fin:
            raise ErreurDemande(MESSAGE_FIN_MANQUANTE)
        position_fin = _position_endroit_fin(cle_fin, tous_les_endroits, cache)
        if position_fin is None:
            raise ErreurDemande(MESSAGE_FIN_INTROUVABLE)
        lieu_fin = Lieu(f"fin:{cle_fin}", position_fin[0], position_fin[1])
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
    # Les départs à la position de l'équipe et l'endroit de fin viennent après les arrêts :
    # les indices du cas par défaut ne changent pas.
    n_arrets = len(lieux)
    lieux.extend(lieux_departs)
    lieux.extend(lieux_arrivees)
    if lieu_fin is not None:
        lieux.append(lieu_fin)
    indices_departs = list(range(n_arrets, n_arrets + len(lieux_departs)))
    indices_fins = list(range(n_arrets + len(lieux_departs), len(lieux)))
    temps, dist, pen, source = construire_matrices(
        lieux, cache, client_osrm, indices_departs, indices_fins
    )

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
        parametres=Parametres(
            intervention_s=INTERVENTION_S,
            limite_s=limite,
            fin=fin_mode,
            fin_lieu=lieu_fin.id if lieu_fin is not None else None,
        ),
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
        parametres = demande.get("parametres") or {}
        veut_position = (
            parametres.get("depart") == "position"
            or "position" in (parametres.get("depart_par_equipe") or {}).values()
        )
        positions = magasin.positions_equipes() if veut_position else None
        voulues = set(parametres.get("equipe_ids") or [])
        toutes_les_equipes = {e["id"] for e in equipes}
        # « tournee » : recalcul de la tournée de ces équipes, quel que soit le nombre d'équipes actives
        # (les arrêts faits restent en tête). « global » (défaut) : calcul de tous les arrêts.
        recalcul = parametres.get("recalcul") or "global"
        if recalcul not in ("global", "tournee"):
            raise ErreurDemande(MESSAGE_RECALCUL_INCONNU)
        if recalcul == "tournee" and not voulues:
            raise ErreurDemande(MESSAGE_RECALCUL_SANS_EQUIPE)
        partiel_equipes = bool(voulues) and (
            bool(toutes_les_equipes - voulues) or recalcul == "tournee"
        )
        en_place: list[dict[str, Any]] = []
        if partiel_equipes:
            lire = getattr(magasin, "tournees_en_place", None)
            en_place = lire() if lire else []
        fin_position_defaut = None
        if recalcul == "tournee" and not parametres.get("fin"):
            # Sans fin demandée, chaque tournée recalculée finit comme elle finissait (et non au garage).
            par_equipe = dict(parametres.get("fin_par_equipe") or {})
            for ligne in en_place:
                equipe_id = ligne["equipe_id"]
                details = ligne.get("details") or {}
                fin_en_place = details.get("fin")
                if equipe_id not in voulues or equipe_id in par_equipe or not fin_en_place:
                    continue
                position_fin = details.get("fin_position") or {}
                if fin_en_place in ("garage", "libre", "arrivee"):
                    par_equipe[equipe_id] = fin_en_place
                elif fin_en_place == "endroit" and "latitude" in position_fin:
                    parametres = {**parametres, "fin": "endroit"}
                    fin_position_defaut = (position_fin["latitude"], position_fin["longitude"])
            if par_equipe != (parametres.get("fin_par_equipe") or {}):
                parametres = {**parametres, "fin_par_equipe": par_equipe}
        etape("lecture base")
        client = None
        if utiliser_osrm:
            # Trajets des lieux hors du cache (nouveaux endroits, départs à la position, fin) : au plus
            # 3 s au total, par OSRM `table` ; sinon vol d'oiseau.
            client = httpx.Client(timeout=8.0, headers={"User-Agent": USER_AGENT_OSRM})
        try:
            donnees, incidents, jour = construire_donnees(
                parametres,
                equipes,
                incidents_lus,
                signalements,
                cache,
                positions=positions,
                client_osrm=client,
                exclure_cles=cles_a_exclure(en_place, voulues) if partiel_equipes else None,
                fin_position_defaut=fin_position_defaut,
            )
        finally:
            if client is not None:
                client.close()
        etape("matrices")
        sortie = resoudre(donnees.probleme)
        etape("solveur")
        resultat = vers_resultat(
            sortie, donnees, jour, incidents, demande_id=demande_id, precalcule=False
        )
        if partiel_equipes:
            noms = {e["id"]: e["nom"] for e in equipes}
            fusionner(resultat, en_place, voulues, noms)
        elif _selection_partielle(parametres, signalements):
            resultat["portee"] = resultat["comparaison"]["portee"] = "partiel"
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


def _colonne_absente(erreur: Exception) -> bool:
    """La colonne `details` n'existe pas encore (migration 0006 non lancée)."""
    code = str(getattr(erreur, "code", "") or "")
    message = str(getattr(erreur, "message", "") or erreur)
    return code in ("PGRST204", "42703") or "details" in message and "column" in message


def _fonction_absente(erreur: Exception) -> bool:
    code = str(getattr(erreur, "code", "") or "")
    message = str(getattr(erreur, "message", "") or erreur)
    return code in ("PGRST202", "42883") or "Could not find the function" in message


class MagasinSupabase:
    def __init__(self, client: Any, journal=print) -> None:
        self.c = client
        self.journal = journal
        self._sans_details = False

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
            self._restaurer_faits(demande_id, resultat)
            return
        except Exception as e:
            if not _fonction_absente(e):
                raise
        _signaler_une_fois(
            "publier_tournees n'existe pas encore (migration 0004 non lancée) : écriture ligne par ligne.",
            self.journal,
        )
        self._publier_par_lignes(demande_id, resultat)

    def tournees_en_place(self) -> list[dict[str, Any]]:
        return self.c.table("tournees").select("*, arrets(*)").execute().data

    def _restaurer_faits(self, demande_id: str, resultat: dict[str, Any]) -> None:
        """Remet à faits les arrêts déjà faits d'un plan republié, si `publier_tournees` ne l'a pas fait (avant la 0006)."""
        faits = [
            (t["equipe_id"], a["rang"], a.get("fait_le"))
            for t in resultat["tournees"]
            for a in t.get("arrets", [])
            if a.get("fait")
        ]
        if not faits:
            return
        try:
            lignes = (
                self.c.table("tournees")
                .select("id,equipe_id")
                .eq("demande_id", demande_id)
                .execute()
                .data
            )
            ids = {ligne["equipe_id"]: ligne["id"] for ligne in lignes}
            # Avec la migration 0006, `publier_tournees` écrit déjà fait et fait_le : on ne corrige que
            # ce qui manque (sans elle, tous les arrêts faits republiés).
            deja = {
                (ligne["tournee_id"], ligne["rang"])
                for ligne in self.c.table("arrets")
                .select("tournee_id,rang")
                .eq("demande_id", demande_id)
                .eq("fait", True)
                .execute()
                .data
            }
            for equipe_id, rang, fait_le in faits:
                if (ids[equipe_id], rang) in deja:
                    continue
                (
                    self.c.table("arrets")
                    .update({"fait": True, "fait_le": fait_le})
                    .eq("tournee_id", ids[equipe_id])
                    .eq("rang", rang)
                    .execute()
                )
        except Exception as e:  # noqa: BLE001 : le plan est publié ; on le dit au journal
            self.journal(f"Arrêts faits non restaurés ({type(e).__name__}).")

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

    def positions_equipes(self) -> list[dict[str, Any]]:
        """Dernières positions des équipes. Table absente (migration 0005 non lancée) : aucune position."""
        try:
            return self.c.table("positions_equipes").select("*").execute().data
        except Exception as e:  # noqa: BLE001
            self.journal(
                f"Positions des équipes indisponibles ({type(e).__name__}) : départ au garage."
            )
            return []

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
            charge = {
                "demande_id": demande_id,
                "equipe_id": t["equipe_id"],
                "distance_m": t["distance_m"],
                "duree_s": t["duree_s"],
                "debut_prevu": t["debut_prevu"],
                "fin_prevue": t["fin_prevue"],
                "geometrie": t["geometrie"],
            }
            details = details_de(t)
            ligne = None
            if details and not self._sans_details:
                try:
                    ligne = (
                        self.c.table("tournees")
                        .insert({**charge, "details": details})
                        .execute()
                        .data[0]
                    )
                except Exception as e:
                    if not _colonne_absente(e):
                        raise
                    self._sans_details = True  # migration 0006 non lancée : tournée sans détails
            if ligne is None:
                ligne = self.c.table("tournees").insert(charge).execute().data[0]
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
                            # Colonnes fait et fait_le seulement pour un arrêt déjà fait (plan republié).
                            **(
                                {"fait": True, "fait_le": a.get("fait_le")} if a.get("fait") else {}
                            ),
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
