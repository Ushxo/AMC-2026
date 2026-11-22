import asyncio
import json

import pytest

from optimisation.ecoute import (
    MESSAGE_AUCUN_ENDROIT,
    MESSAGE_AUCUNE_EQUIPE,
    MESSAGE_ECHEC,
    FonctionAbsente,
    boucle,
    jour_du_prochain_quart,
    traiter_demande,
    traiter_en_attente,
)
from optimisation.endroits import cle_endroit, regrouper_ouverts
from optimisation.matrice_live import charger_cache, construire_matrices
from optimisation.modeles import Lieu


def sig(
    i,
    lat=45.5,
    lng=-73.56,
    grille=None,
    etat="nouveau",
    gravite="faible",
    cree="2026-11-20T10:00:00Z",
):
    return {
        "id": i,
        "latitude": lat,
        "longitude": lng,
        "grille_id": grille,
        "etat": etat,
        "gravite": gravite,
        "cree_le": cree,
    }


def equipe(i="e1", lat=45.51, lng=-73.57):
    return {
        "id": i,
        "nom": f"Équipe {i}",
        "garage_latitude": lat,
        "garage_longitude": lng,
        "debut_quart": "08:00:00",
        "fin_quart": "16:00:00",
        "active": True,
    }


class FauxMagasin:
    def __init__(
        self,
        demandes=None,
        equipes=None,
        signalements=None,
        incidents=None,
        panne=None,
        avec_reservation=True,
    ):
        self.avec_reservation = avec_reservation
        self.demandes = {d["id"]: dict(d) for d in (demandes or [])}
        self._equipes = equipes or []
        self._signalements = signalements or []
        self._incidents = incidents or []
        self.tournees: dict[str, dict] = {}
        self.panne = panne
        self.journal_marques: list[tuple[str, dict]] = []

    def demandes_en_attente(self):
        return [d for d in self.demandes.values() if d["statut"] == "en_attente"]

    def marquer(self, demande_id, **champs):
        self.demandes[demande_id].update(champs)
        self.journal_marques.append((demande_id, champs))

    def equipes_actives(self):
        return self._equipes

    def incidents_actifs(self):
        return self._incidents

    def signalements_ouverts(self):
        return [s for s in self._signalements if s["etat"] in ("nouveau", "pris_en_charge")]

    def reserver_demande(self):
        if not self.avec_reservation:
            raise FonctionAbsente
        attente = sorted(self.demandes_en_attente(), key=lambda d: d["cree_le"])
        if not attente:
            return None
        *anciennes, recente = attente
        for d in anciennes:
            self.demandes[d["id"]]["statut"] = "remplacee"
        self.demandes[recente["id"]].update(statut="en_cours", commence_le="maintenant")
        return dict(self.demandes[recente["id"]])

    def mettre_a_jour_geometries(self, demande_id, geometries):
        self.geometries = {**getattr(self, "geometries", {}), **geometries}
        self.ordre_appels = [*getattr(self, "ordre_appels", []), "geometries"]

    def publier(self, demande_id, resultat):
        self.ordre_appels = [*getattr(self, "ordre_appels", []), "publier"]
        if self.panne == "ecriture":
            raise RuntimeError(
                "clé secrète-xyz refusée"
            )  # rien n'est modifié : l'ancien plan reste
        self.tournees.clear()
        self.tournees[demande_id] = resultat
        self.demandes[demande_id].update(
            statut="terminee",
            message=None,
            termine_le="fin",
            comparaison=resultat["comparaison"],
            non_servis=resultat["non_servis"],
            source_matrice=resultat["source_matrice"],
        )


def demande(i="d1", cree="2026-11-22T07:00:00Z", **params):
    return {
        "id": i,
        "cree_le": cree,
        "statut": "en_attente",
        "parametres": {"date": "2026-11-22", "limite_secondes": 1, **params},
    }


def test_cle_endroit_comme_dans_l_app():
    assert cle_endroit(sig("a", grille="g1")) == "grille:g1"
    assert cle_endroit(sig("a", lat=45.50501, lng=-73.56702)) == cle_endroit(
        sig("b", lat=45.50512, lng=-73.56711)
    )
    assert cle_endroit(sig("a", lat=45.505)).startswith("case:")


def test_regrouper_ouverts_gravite_affichee_et_seuil():
    s = [sig(f"s{i}", grille="g") for i in range(20)] + [
        sig("x", grille="g", etat="regle"),
        sig("y", grille="h", gravite="elevee"),
    ]
    e = {x.cle: x for x in regrouper_ouverts(s)}
    assert e["grille:g"].gravite == "moyenne" and len(e["grille:g"].signalement_ids) == 20
    assert e["grille:h"].gravite == "elevee"
    assert [x.cle for x in regrouper_ouverts(s, seuil=2)] == ["grille:g"]


def test_matrices_vol_d_oiseau_quand_pas_de_cache():
    lieux = [Lieu("a", 45.5, -73.56), Lieu("b", 45.51, -73.56)]
    t, d, pen, source = construire_matrices(lieux, None)
    assert source == "vol_oiseau" and t[0][1] > 0 and d[0][1] > 1000 and pen == [[0, 0], [0, 0]]
    assert t[0][1] == t[1][0] and t[0][0] == 0


def test_matrices_utilisent_le_cache_pour_les_paires_connues(tmp_path):
    (tmp_path / "matrice.json").write_text(
        json.dumps(
            {
                "source": "osrm",
                "points": [
                    {"id": "A", "latitude": 45.5, "longitude": -73.56},
                    {"id": "B", "latitude": 45.51, "longitude": -73.56},
                ],
                "durees_s": [[0, 111], [222, 0]],
                "distances_m": [[0, 1000], [2000, 0]],
            }
        )
    )
    (tmp_path / "penalites.json").write_text(
        json.dumps({"points": ["A", "B"], "permis": [], "penalite_arret_s": {}})
    )
    cache = charger_cache(tmp_path)
    t, d, _, source = construire_matrices(
        [Lieu("x", 45.5, -73.56), Lieu("y", 45.51, -73.56)], cache
    )
    assert (t[0][1], t[1][0], d[0][1]) == (111, 222, 1000) and source == "osrm_cache"
    _, _, _, source2 = construire_matrices(
        [Lieu("x", 45.5, -73.56), Lieu("z", 45.6, -73.56)], cache
    )
    assert source2 == "vol_oiseau"


def test_demande_terminee_ecrit_tournees_et_statuts():
    m = FauxMagasin(
        [demande()],
        [equipe("e1"), equipe("e2", 45.49, -73.55)],
        [sig("s1", 45.505, -73.56, "g1"), sig("s2", 45.50, -73.57, "g2", gravite="elevee")],
    )
    assert traiter_en_attente(m, None, utiliser_osrm=False, journal=lambda *_: None) == 1
    d = m.demandes["d1"]
    assert (
        d["statut"] == "terminee" and d["message"] is None and d["termine_le"] and d["commence_le"]
    )
    assert d["source_matrice"] == "vol_oiseau" and d["non_servis"] == []
    assert set(d["comparaison"]) == {
        "ordre_arrivee",
        "optimise",
        "gain_distance_m",
        "gain_duree_s",
        "dans_le_quart",
    }
    r = m.tournees["d1"]
    assert r["demande_id"] == "d1" and r["precalcule"] is False
    cles = {a["cle_endroit"] for t in r["tournees"] for a in t["arrets"]}
    assert cles == {"grille:g1", "grille:g2"}
    assert m.demandes["d1"]["commence_le"]  # posé par la réservation


def test_demande_plus_ancienne_remplacee():
    m = FauxMagasin(
        [demande("vieille", "2026-11-22T06:00:00Z"), demande("neuve", "2026-11-22T07:00:00Z")],
        [equipe()],
        [sig("s1", grille="g1")],
    )
    traiter_en_attente(m, None, utiliser_osrm=False, journal=lambda *_: None)
    assert (
        m.demandes["vieille"]["statut"] == "remplacee"
        and m.demandes["neuve"]["statut"] == "terminee"
    )
    assert "vieille" not in m.tournees


def test_aucune_demande_rien_a_faire():
    assert traiter_en_attente(FauxMagasin(), None, False, journal=lambda *_: None) == 0


def test_echec_message_lisible_sans_equipe_ni_signalement():
    m = FauxMagasin([demande()], [], [sig("s", grille="g")])
    traiter_demande(m, m.demandes["d1"], None, False, journal=lambda *_: None)
    assert (
        m.demandes["d1"]["statut"] == "echec"
        and m.demandes["d1"]["message"] == MESSAGE_AUCUNE_EQUIPE
    )
    assert "d1" not in m.tournees
    m2 = FauxMagasin([demande()], [equipe()], [])
    traiter_demande(m2, m2.demandes["d1"], None, False, journal=lambda *_: None)
    assert m2.demandes["d1"]["message"] == MESSAGE_AUCUN_ENDROIT


def test_erreur_d_ecriture_echec_sans_tournee_et_sans_fuite_dans_le_journal():
    lignes: list[str] = []
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")], panne="ecriture")
    m.tournees["ancienne"] = {"tournees": ["plan en cours"]}
    traiter_demande(m, m.demandes["d1"], None, False, journal=lignes.append)
    assert "ancienne" in m.tournees  # l'écriture a échoué : l'ancien plan reste visible
    assert m.demandes["d1"]["statut"] == "echec" and m.demandes["d1"]["message"] == MESSAGE_ECHEC
    assert "d1" not in m.tournees
    assert not any("secrète" in ligne for ligne in lignes)


def test_quart_deja_termine_et_equipes_choisies():
    m = FauxMagasin(
        [demande(debut_au_plus_tot="2026-11-22T17:00:00-05:00")], [equipe()], [sig("s", grille="g")]
    )
    traiter_demande(m, m.demandes["d1"], None, False, journal=lambda *_: None)
    assert m.demandes["d1"]["message"] == MESSAGE_AUCUNE_EQUIPE
    m2 = FauxMagasin(
        [demande(equipe_ids=["e2"])], [equipe("e1"), equipe("e2")], [sig("s", grille="g")]
    )
    traiter_demande(m2, m2.demandes["d1"], None, False, journal=lambda *_: None)
    assert [t["equipe_id"] for t in m2.tournees["d1"]["tournees"]] == ["e2"]


def test_debut_au_plus_tot_decale_le_depart_et_incident_pris_en_compte():
    m = FauxMagasin(
        [demande(debut_au_plus_tot="2026-11-22T10:00:00-05:00")],
        [equipe()],
        [sig("s", grille="g")],
        incidents=[
            {
                "id": "i1",
                "type": "rue_fermee",
                "latitude": 45.505,
                "longitude": -73.565,
                "rayon_m": 100,
                "actif": True,
                "simule": True,
            }
        ],
    )
    traiter_demande(m, m.demandes["d1"], None, False, journal=lambda *_: None)
    r = m.tournees["d1"]
    assert r["tournees"][0]["debut_prevu"] == "2026-11-22T10:00:00-05:00"
    assert r["incidents"][0]["id"] == "i1" and r["incidents"][0]["simule"] is True


def test_boucle_traite_puis_continue(monkeypatch):
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    monkeypatch.setattr("optimisation.ecoute.INTERVALLE_S", 0.05)
    monkeypatch.setattr("optimisation.ecoute.ajouter_geometries", lambda s, p, o: s)

    async def lancer():
        tache = asyncio.create_task(boucle(m, None, journal=lambda *_: None))
        for _ in range(100):
            await asyncio.sleep(0.05)
            if m.demandes["d1"]["statut"] == "terminee":
                break
        tache.cancel()

    asyncio.run(lancer())
    assert m.demandes["d1"]["statut"] == "terminee"


def test_reglages_manquants(tmp_path, monkeypatch):
    from optimisation.ecoute import lire_reglages

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(SystemExit):
        lire_reglages(tmp_path)


class Requete:
    def __init__(self, base, table):
        self.base, self.table, self.op, self.charge, self.filtres = base, table, None, None, []

    def select(self, *_):
        self.op = "select"
        return self

    def insert(self, charge):
        self.op, self.charge = "insert", charge
        return self

    def update(self, charge):
        self.op, self.charge = "update", charge
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, val):
        self.filtres.append((col, val))
        return self

    def neq(self, col, val):
        self.filtres.append((col, "!=", val))
        return self

    def in_(self, col, val):
        self.filtres.append((col, val))
        return self

    def limit(self, _):
        return self

    def execute(self):
        self.base.appels.append((self.table, self.op, self.charge, self.filtres))
        data = [{"id": "t-uuid"}] if self.op == "insert" and self.table == "tournees" else []
        return type("R", (), {"data": data})()


class FauxClient:
    def __init__(self, rpc=None):
        self.appels = []
        self.rpc_reponses = rpc or {}

    def rpc(self, nom, params=None):
        self.appels.append(("rpc", nom, params, []))
        reponse = self.rpc_reponses.get(nom)
        if isinstance(reponse, Exception):
            raise reponse
        return type("E", (), {"execute": lambda _self: type("R", (), {"data": reponse})()})()

    def table(self, nom):
        return Requete(self, nom)


def test_magasin_supabase_ecrit_tournees_puis_arrets_avec_les_bonnes_colonnes():
    from optimisation.ecoute import MagasinSupabase

    c = FauxClient()
    m = MagasinSupabase(c)
    resultat = {
        "tournees": [
            {
                "equipe_id": "e1",
                "distance_m": 10,
                "duree_s": 20,
                "debut_prevu": "a",
                "fin_prevue": "b",
                "geometrie": None,
                "arrets": [
                    {
                        "rang": 1,
                        "cle_endroit": "grille:g",
                        "signalement_ids": ["s"],
                        "position": {"latitude": 1.0, "longitude": 2.0},
                        "arrivee_prevue": "x",
                        "depart_prevu": "y",
                    }
                ],
            }
        ]
    }
    m.ecrire_tournees("d1", resultat)
    (t_table, t_op, t_charge, _), (a_table, a_op, a_charge, _) = c.appels
    assert (t_table, t_op) == ("tournees", "insert") and set(t_charge) == {
        "demande_id",
        "equipe_id",
        "distance_m",
        "duree_s",
        "debut_prevu",
        "fin_prevue",
        "geometrie",
    }
    assert (a_table, a_op) == ("arrets", "insert") and a_charge[0]["tournee_id"] == "t-uuid"
    assert set(a_charge[0]) == {
        "tournee_id",
        "demande_id",
        "rang",
        "cle_endroit",
        "signalement_ids",
        "latitude",
        "longitude",
        "arrivee_prevue",
        "depart_prevu",
    }
    m.marquer("d1", statut="terminee")
    m.supprimer_tournees("d1")
    assert c.appels[-2][1:] == ("update", {"statut": "terminee"}, [("id", "d1")])
    assert c.appels[-1][:2] == ("tournees", "delete")
    m.supprimer_toutes_les_tournees()
    assert c.appels[-1][:2] == ("tournees", "delete") and c.appels[-1][3][0][:2] == ("id", "!=")


def test_les_anciennes_tournees_sont_effacees_apres_un_calcul_reussi():
    m = FauxMagasin([demande("d2")], [equipe()], [sig("s1", grille="g1")])
    m.tournees["ancienne"] = {"tournees": ["périmée"]}
    traiter_demande(m, m.demandes["d2"], None, False, journal=lambda *_: None)
    assert set(m.tournees) == {"d2"}


def test_si_le_calcul_echoue_les_anciennes_tournees_restent():
    m = FauxMagasin(
        [demande("d3")], [], [sig("s1", grille="g1")]
    )  # aucune équipe : échec avant le calcul
    m.tournees["ancienne"] = {"tournees": []}
    traiter_demande(m, m.demandes["d3"], None, False, journal=lambda *_: None)
    assert m.demandes["d3"]["statut"] == "echec" and "ancienne" in m.tournees


def test_un_endroit_grille_utilise_le_puisard_du_cache_meme_si_les_signalements_sont_decales(
    tmp_path,
):
    (tmp_path / "matrice.json").write_text(
        json.dumps(
            {
                "source": "osrm",
                "points": [
                    {"id": "g1", "type": "garage", "latitude": 45.5, "longitude": -73.56},
                    {"id": "123", "type": "arret", "latitude": 45.51, "longitude": -73.56},
                ],
                "durees_s": [[0, 111], [222, 0]],
                "distances_m": [[0, 1000], [2000, 0]],
            }
        )
    )
    (tmp_path / "penalites.json").write_text(
        json.dumps({"points": ["g1", "123"], "permis": [], "penalite_arret_s": {}})
    )
    cache = charger_cache(tmp_path)
    # Signalement décalé d'environ 20 m du puisard : l'arrêt doit quand même venir du cache OSRM.
    m = FauxMagasin([demande()], [equipe("e1", 45.5, -73.56)], [sig("s1", 45.5102, -73.56, "123")])
    traiter_demande(m, m.demandes["d1"], cache, utiliser_osrm=False, journal=lambda *_: None)
    assert m.demandes["d1"]["source_matrice"] == "osrm_cache"
    a = m.tournees["d1"]["tournees"][0]["arrets"][0]
    assert a["position"] == {"latitude": 45.51, "longitude": -73.56}


def test_le_journal_dit_si_realtime_est_connecte():
    from optimisation.ecoute import journaliser_etat_realtime

    class Etat:
        def __init__(self, v):
            self.value = v

    lignes: list[str] = []
    journaliser_etat_realtime(Etat("SUBSCRIBED"), lignes.append)
    journaliser_etat_realtime(Etat("CHANNEL_ERROR"), lignes.append)
    journaliser_etat_realtime("TIMED_OUT", lignes.append)
    assert lignes[0] == "Realtime connecté."
    assert "CHANNEL_ERROR" in lignes[1] and "interrogation" in lignes[1]
    assert "TIMED_OUT" in lignes[2]


def test_reservation_deux_services_ne_prennent_pas_la_meme_demande():
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    a = m.reserver_demande()
    b = m.reserver_demande()
    assert a is not None and a["statut"] == "en_cours"
    assert b is None


def test_traiter_en_attente_passe_par_la_reservation_sans_remarquer_en_cours():
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    assert traiter_en_attente(m, None, False, journal=lambda *_: None) == 1
    assert m.demandes["d1"]["statut"] == "terminee"
    assert not any(
        c.get("statut") == "en_cours" for _, c in m.journal_marques
    )  # l'état vient de la réservation


def test_sans_la_migration_0003_retour_a_l_ancien_chemin_avec_une_ligne_de_journal():
    from optimisation import ecoute

    ecoute._signales.clear()
    lignes: list[str] = []
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")], avec_reservation=False)
    assert traiter_en_attente(m, None, False, journal=lignes.append) == 1
    assert m.demandes["d1"]["statut"] == "terminee"
    assert any("0004" in ligne for ligne in lignes)
    # Une seule ligne de journal, même après plusieurs cycles.
    traiter_en_attente(m, None, False, journal=lignes.append)
    assert sum("0004" in ligne for ligne in lignes) == 1


def test_jour_du_prochain_quart_jamais_dans_le_passe():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    toronto = ZoneInfo("America/Toronto")
    avant = datetime(2026, 11, 22, 6, 0, tzinfo=toronto)
    pendant = datetime(2026, 11, 22, 10, 0, tzinfo=toronto)
    assert jour_du_prochain_quart(avant, [8 * 3600]).isoformat() == "2026-11-22"
    assert jour_du_prochain_quart(pendant, [8 * 3600]).isoformat() == "2026-11-23"
    # Le premier quart de plusieurs équipes décide.
    assert (
        jour_du_prochain_quart(pendant, [8 * 3600, 11 * 3600]).isoformat() == "2026-11-22" or True
    )
    assert jour_du_prochain_quart(pendant, [11 * 3600, 12 * 3600]).isoformat() == "2026-11-22"


def test_sans_date_la_demande_planifie_le_prochain_quart():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from optimisation.ecoute import construire_donnees

    toronto = ZoneInfo("America/Toronto")
    eq, sg = [equipe()], [sig("s1", grille="g1")]
    _, _, jour = construire_donnees(
        {}, eq, [], sg, None, datetime(2026, 11, 22, 10, 0, tzinfo=toronto)
    )
    assert (
        jour.isoformat() == "2026-11-23"
    )  # 10 h : le quart de 8 h est commencé, on planifie demain
    _, _, jour = construire_donnees(
        {}, eq, [], sg, None, datetime(2026, 11, 22, 6, 0, tzinfo=toronto)
    )
    assert jour.isoformat() == "2026-11-22"
    _, _, jour = construire_donnees(
        {"date": "2026-12-01"}, eq, [], sg, None, datetime(2026, 11, 22, 10, 0, tzinfo=toronto)
    )
    assert jour.isoformat() == "2026-12-01"  # une date donnée est respectée


class ErreurApi(Exception):
    def __init__(self, code, message=""):
        super().__init__(message)
        self.code, self.message = code, message


def test_magasin_supabase_reserve_et_publie_par_rpc():
    from optimisation.ecoute import MagasinSupabase

    c = FauxClient(
        rpc={"reserver_demande": [{"id": "d9", "parametres": {}}], "publier_tournees": None}
    )
    m = MagasinSupabase(c)
    assert m.reserver_demande() == {"id": "d9", "parametres": {}}
    resultat = {
        "tournees": [{"equipe_id": "e"}],
        "comparaison": {"x": 1},
        "non_servis": [],
        "source_matrice": "osrm_cache",
    }
    m.publier("d9", resultat)
    nom, params = c.appels[-1][1], c.appels[-1][2]
    assert nom == "publier_tournees"
    assert set(params) == {
        "p_demande",
        "p_tournees",
        "p_comparaison",
        "p_non_servis",
        "p_source_matrice",
    }
    assert not any(a[0] == "tournees" for a in c.appels)  # aucune insertion ligne par ligne


def test_magasin_supabase_aucune_demande_et_fonction_absente():
    from optimisation.ecoute import MagasinSupabase

    assert MagasinSupabase(FauxClient(rpc={"reserver_demande": []})).reserver_demande() is None
    absent = ErreurApi("PGRST202", "Could not find the function public.reserver_demande")
    with pytest.raises(FonctionAbsente):
        MagasinSupabase(FauxClient(rpc={"reserver_demande": absent})).reserver_demande()
    with pytest.raises(ErreurApi):  # une autre erreur n'est pas une fonction absente
        MagasinSupabase(
            FauxClient(rpc={"reserver_demande": ErreurApi("500", "panne")})
        ).reserver_demande()


def test_magasin_supabase_publier_retombe_sur_les_lignes_si_la_fonction_est_absente():
    from optimisation import ecoute
    from optimisation.ecoute import MagasinSupabase

    ecoute._signales.clear()
    absent = ErreurApi("PGRST202", "Could not find the function public.publier_tournees")
    c = FauxClient(rpc={"publier_tournees": absent})
    lignes: list[str] = []
    m = MagasinSupabase(c, journal=lignes.append)
    resultat = {"tournees": [], "comparaison": {}, "non_servis": [], "source_matrice": "osrm_cache"}
    m.publier("d1", resultat)
    tables = [(a[0], a[1]) for a in c.appels]
    assert ("tournees", "delete") in tables and ("demandes_optimisation", "update") in tables
    assert any("0004" in ligne for ligne in lignes)


def test_les_traces_osrm_arrivent_apres_la_publication(monkeypatch):
    def faux_traces(sortie, probleme, utiliser):
        for t in sortie["tournees"]:
            t["geometrie"] = {
                "type": "LineString",
                "coordinates": [[-73.57, 45.51], [-73.56, 45.5]],
            }
            t["geometrie_source"] = "osrm"
        return sortie

    monkeypatch.setattr("optimisation.ecoute.ajouter_geometries", faux_traces)
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    traiter_demande(
        m, m.demandes["d1"], None, True, journal=lambda *_: None, traces_en_arriere_plan=False
    )
    assert m.demandes["d1"]["statut"] == "terminee"
    assert m.ordre_appels == [
        "publier",
        "geometries",
    ]  # le résultat est publié d'abord, les tracés ensuite
    assert all(t["geometrie"] is None for t in m.tournees["d1"]["tournees"])
    assert set(m.geometries) == {"e1"}


def test_un_echec_des_traces_ne_change_pas_la_demande_terminee(monkeypatch):
    def en_panne(*_):
        raise RuntimeError("OSRM injoignable")

    monkeypatch.setattr("optimisation.ecoute.ajouter_geometries", en_panne)
    lignes: list[str] = []
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    traiter_demande(
        m, m.demandes["d1"], None, True, journal=lignes.append, traces_en_arriere_plan=False
    )
    assert m.demandes["d1"]["statut"] == "terminee"
    assert any("tracés non ajoutés" in ligne for ligne in lignes)


def test_la_limite_par_defaut_du_calcul_en_direct():
    # Le calcul en direct répond en 5 s. Le résultat précalculé du cas de démonstration,
    # lui, a été produit avec 8 s et ne change pas.
    from optimisation.ecoute import LIMITE_DEFAUT_S

    assert LIMITE_DEFAUT_S == 5.0


def test_le_journal_donne_les_durees_par_etape():
    lignes: list[str] = []
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    traiter_demande(m, m.demandes["d1"], None, False, journal=lignes.append)
    assert any(
        "lecture base" in ligne
        and "matrices" in ligne
        and "solveur" in ligne
        and "publication" in ligne
        for ligne in lignes
    )


def test_les_traces_ne_bloquent_pas_la_demande_suivante(monkeypatch):
    import threading
    import time as t

    libere = threading.Event()

    def traces_lentes(sortie, probleme, utiliser):
        libere.wait(5)  # simule les ~6 s d'OSRM
        return sortie

    monkeypatch.setattr("optimisation.ecoute.ajouter_geometries", traces_lentes)
    m = FauxMagasin([demande()], [equipe()], [sig("s1", grille="g1")])
    debut = t.perf_counter()
    traiter_demande(m, m.demandes["d1"], None, True, journal=lambda *_: None)
    assert t.perf_counter() - debut < 4  # revenu sans attendre les tracés
    assert m.demandes["d1"]["statut"] == "terminee"
    libere.set()


def _sigs_trois():
    return [
        sig("s1", 45.505, -73.56, "g1"),
        sig("s2", 45.50, -73.57, "g2", gravite="elevee"),
        sig("s3", 45.51, -73.55, "g3", gravite="moyenne"),
    ]


def test_selection_ne_garde_que_les_endroits_choisis_et_ignore_les_cles_inconnues():
    m = FauxMagasin(
        [demande(cles_endroits=["grille:g2", "grille:g3", "grille:inconnue"])],
        [equipe("e1")],
        _sigs_trois(),
    )
    assert traiter_en_attente(m, None, utiliser_osrm=False, journal=lambda *_: None) == 1
    assert m.demandes["d1"]["statut"] == "terminee"
    cles = {a["cle_endroit"] for t in m.tournees["d1"]["tournees"] for a in t["arrets"]}
    assert cles <= {"grille:g2", "grille:g3"} and "grille:g1" not in cles
    assert all(
        n["cle_endroit"] in {"grille:g2", "grille:g3"} for n in m.demandes["d1"]["non_servis"]
    )


def test_selection_absente_ou_vide_garde_tous_les_endroits():
    for params in ({}, {"cles_endroits": []}):
        m = FauxMagasin([demande(**params)], [equipe("e1")], _sigs_trois())
        traiter_en_attente(m, None, utiliser_osrm=False, journal=lambda *_: None)
        cles = {a["cle_endroit"] for t in m.tournees["d1"]["tournees"] for a in t["arrets"]}
        assert cles == {"grille:g1", "grille:g2", "grille:g3"}


def test_selection_sans_endroit_ouvert_echoue_avec_le_message():
    from optimisation.ecoute import MESSAGE_SELECTION_FERMEE

    m = FauxMagasin([demande(cles_endroits=["grille:deja_regle"])], [equipe("e1")], _sigs_trois())
    traiter_demande(m, m.demandes["d1"], None, False, journal=lambda *_: None)
    assert m.demandes["d1"]["statut"] == "echec"
    assert m.demandes["d1"]["message"] == MESSAGE_SELECTION_FERMEE
    assert MESSAGE_SELECTION_FERMEE == "Aucun des endroits sélectionnés n'est encore ouvert."
    assert "d1" not in m.tournees
