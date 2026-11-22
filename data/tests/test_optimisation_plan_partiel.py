"""Recalcul pour une partie des équipes : les autres tournées et les arrêts faits sont conservés."""

import pytest
from test_optimisation_ecoute import FauxMagasin, demande, equipe, sig

from optimisation.ecoute import (
    MESSAGE_RECALCUL_INCONNU,
    MESSAGE_RECALCUL_SANS_EQUIPE,
    MESSAGE_RIEN_A_REPLANIFIER,
    MagasinSupabase,
    traiter_demande,
)
from optimisation.plan_partiel import cles_a_exclure, details_de, fusionner, totaux


class MagasinPlan(FauxMagasin):
    """Magasin en mémoire qui garde le plan publié comme le fait la base (tournées avec arrêts)."""

    def __init__(self, **kw):
        super().__init__(**kw)
        self.en_place: list[dict] = []

    def tournees_en_place(self):
        return [{**t, "arrets": [dict(a) for a in t["arrets"]]} for t in self.en_place]

    def publier(self, demande_id, resultat):
        super().publier(demande_id, resultat)
        self.en_place = [
            {
                "equipe_id": t["equipe_id"],
                "distance_m": t["distance_m"],
                "duree_s": t["duree_s"],
                "debut_prevu": t["debut_prevu"],
                "fin_prevue": t["fin_prevue"],
                "geometrie": t.get("geometrie"),
                "details": details_de(t),
                "arrets": [
                    {
                        "rang": a["rang"],
                        "cle_endroit": a["cle_endroit"],
                        "signalement_ids": a["signalement_ids"],
                        "latitude": a["position"]["latitude"],
                        "longitude": a["position"]["longitude"],
                        "arrivee_prevue": a["arrivee_prevue"],
                        "depart_prevu": a["depart_prevu"],
                        "fait": bool(a.get("fait")),
                        "fait_le": a.get("fait_le"),
                    }
                    for a in t["arrets"]
                ],
            }
            for t in resultat["tournees"]
        ]


N = 12


def signalements(n=N):
    # Des endroits répartis sur deux côtés : chacun des deux garages en prend une partie.
    return [
        sig(f"s{i}", lat=45.50 + 0.002 * (i % 4), lng=-73.58 + 0.006 * (i // 3), grille=f"g{i}")
        for i in range(n)
    ]


def equipes():
    # Quart de 70 minutes : une équipe seule ne peut pas servir les 12 endroits.
    return [
        {**equipe("e1", 45.50, -73.58), "fin_quart": "09:10:00"},
        {**equipe("e2", 45.51, -73.56), "fin_quart": "09:10:00"},
    ]


def plan_complet(**kw):
    m = MagasinPlan(demandes=[demande("d1")], equipes=equipes(), signalements=signalements(), **kw)
    traiter_demande(m, m.demandes["d1"], None, utiliser_osrm=False, journal=lambda *_: None)
    return m


def cles(tournee):
    return [a["cle_endroit"] for a in tournee["arrets"]]


def par_equipe(resultat):
    return {t["equipe_id"]: t for t in resultat["tournees"]}


def demande_partielle(m, i="d2", **params):
    m.demandes[i] = demande(i, cree="2026-11-22T08:00:00Z", **params)
    traiter_demande(m, m.demandes[i], None, utiliser_osrm=False, journal=lambda *_: None)
    return m.demandes[i]


def test_plan_complet_porte_complet_sans_marque_dans_la_comparaison():
    m = plan_complet()
    r = m.tournees["d1"]
    assert r["portee"] == "complet" and "portee" not in r["comparaison"]
    assert {t["equipe_id"] for t in r["tournees"]} == {"e1", "e2"}
    assert sum(len(t["arrets"]) for t in r["tournees"]) == N


def test_recalcul_d_une_equipe_garde_les_autres_tournees_et_les_arrets_faits():
    m = plan_complet()
    avant = par_equipe(m.tournees["d1"])
    assert len(avant["e1"]["arrets"]) >= 3 and avant["e2"]["arrets"]
    # Les deux premiers arrêts de e1 sont faits.
    for a in m.en_place[[t["equipe_id"] for t in m.en_place].index("e1")]["arrets"][:2]:
        a["fait"], a["fait_le"] = True, "2026-11-22T09:00:00+00:00"
    faits = [
        a["cle_endroit"]
        for a in m.en_place[[t["equipe_id"] for t in m.en_place].index("e1")]["arrets"][:2]
    ]
    restants = [
        a["cle_endroit"]
        for t in m.en_place
        if t["equipe_id"] == "e1"
        for a in t["arrets"]
        if not a["fait"]
    ]
    d = demande_partielle(m, equipe_ids=["e1"], cles_endroits=restants, depart="garage")
    assert d["statut"] == "terminee"
    r = m.tournees["d2"]
    apres = par_equipe(r)
    # Les autres équipes : tournée republiée telle quelle (mêmes rangs, heures, arrêts).
    assert apres["e2"]["conservee"] is True
    assert apres["e2"]["arrets"] == [
        {**a, "fait": False, "fait_le": None} for a in avant["e2"]["arrets"]
    ]
    for champ in ("distance_m", "duree_s", "debut_prevu", "fin_prevue", "geometrie"):
        assert apres["e2"][champ] == avant["e2"][champ]
    # L'équipe recalculée : les arrêts faits restent en tête avec leur état, puis les restants.
    e1 = apres["e1"]
    assert e1["recalculee"] is True and e1["faits_conserves"] == 2
    assert cles(e1)[:2] == faits
    assert [a["rang"] for a in e1["arrets"]] == list(range(1, len(e1["arrets"]) + 1))
    assert [a["fait"] for a in e1["arrets"][:2]] == [True, True]
    assert e1["arrets"][0]["fait_le"] == "2026-11-22T09:00:00+00:00"
    assert e1["arrets"][0]["arrivee_prevue"] == avant["e1"]["arrets"][0]["arrivee_prevue"]
    assert sorted(cles(e1)[2:]) == sorted(restants)
    assert not any(a["fait"] for a in e1["arrets"][2:])
    # Aucun endroit en double dans tout le plan, et le plan couvre toujours les 12 endroits.
    toutes = [c for t in r["tournees"] for c in cles(t)]
    assert len(toutes) == len(set(toutes)) == N
    # Portée marquée dans la sortie et dans la comparaison (la seule partie que la base garde).
    assert r["portee"] == "partiel" and r["comparaison"]["portee"] == "partiel"
    assert m.demandes["d2"]["comparaison"]["portee"] == "partiel"
    assert r["totaux"] == totaux(r["tournees"])


def test_recalcul_sans_selection_ne_reprend_pas_les_arrets_des_autres_ni_les_faits():
    m = plan_complet()
    ligne_e1 = next(t for t in m.en_place if t["equipe_id"] == "e1")
    ligne_e1["arrets"][0]["fait"] = True
    fait = ligne_e1["arrets"][0]["cle_endroit"]
    du_e2 = set(cles(next(t for t in m.en_place if t["equipe_id"] == "e2")))
    demande_partielle(m, equipe_ids=["e1"])
    apres = par_equipe(m.tournees["d2"])
    assert cles(apres["e1"])[0] == fait
    assert not set(cles(apres["e1"])) & du_e2
    assert set(cles(apres["e2"])) == du_e2


def test_equipe_recalculee_sans_arret_restant_garde_ses_arrets_faits():
    m = plan_complet()
    for t in m.en_place:
        if t["equipe_id"] == "e1":
            for a in t["arrets"]:
                a["fait"] = True
    d = demande_partielle(m, equipe_ids=["e1"])
    # Tout est fait ou aux autres équipes : rien à replanifier, et l'ancien plan reste.
    assert d["statut"] == "echec" and d["message"] == MESSAGE_RIEN_A_REPLANIFIER
    assert "d2" not in m.tournees and "d1" in m.tournees


def test_toutes_les_equipes_demandees_donne_un_plan_complet():
    m = plan_complet()
    demande_partielle(m, equipe_ids=["e1", "e2"])
    r = m.tournees["d2"]
    assert r["portee"] == "complet" and "portee" not in r["comparaison"]
    assert not any(t.get("conservee") for t in r["tournees"])


def test_selection_d_endroits_partielle_ou_complete():
    m = plan_complet()
    toutes = [f"grille:g{i}" for i in range(N)]
    demande_partielle(m, "d2", cles_endroits=toutes[:3])
    assert m.tournees["d2"]["portee"] == "partiel"
    assert m.tournees["d2"]["comparaison"]["portee"] == "partiel"
    demande_partielle(m, "d3", cles_endroits=toutes)
    assert m.tournees["d3"]["portee"] == "complet"
    assert "portee" not in m.tournees["d3"]["comparaison"]


def test_cles_a_exclure_et_fusion_pures():
    en_place = [
        {"equipe_id": "a", "arrets": [{"cle_endroit": "x", "fait": True}, {"cle_endroit": "y"}]},
        {"equipe_id": "b", "arrets": [{"cle_endroit": "z"}]},
    ]
    assert cles_a_exclure(en_place, {"a"}) == {"x", "z"}
    assert cles_a_exclure(en_place, set()) == {"x", "y", "z"}
    resultat = {
        "tournees": [
            {
                "equipe_id": "a",
                "equipe_nom": "A",
                "distance_m": 10,
                "duree_s": 20,
                "arrets": [{"rang": 1, "cle_endroit": "y"}],
            }
        ],
        "comparaison": {},
    }
    ligne_a = {
        **en_place[0],
        "arrets": [
            {
                "rang": 1,
                "cle_endroit": "x",
                "fait": True,
                "latitude": 1,
                "longitude": 2,
                "arrivee_prevue": "t1",
                "depart_prevu": "t2",
            }
        ],
    }
    ligne_b = {
        "equipe_id": "b",
        "distance_m": 5,
        "duree_s": 6,
        "debut_prevu": "d",
        "fin_prevue": "f",
        "arrets": [],
    }
    fusionner(resultat, [ligne_a, ligne_b], {"a"}, {"b": "B"})
    assert [t["equipe_id"] for t in resultat["tournees"]] == ["a", "b"]
    assert [
        (a["rang"], a["cle_endroit"], a["fait"]) for a in resultat["tournees"][0]["arrets"]
    ] == [
        (1, "x", True),
        (2, "y", False),
    ]
    assert resultat["tournees"][1]["equipe_nom"] == "B"
    assert resultat["totaux"] == {"distance_m": 15, "duree_s": 26, "arrets_servis": 2}


# ---------- Supabase : relecture du plan et arrêts faits ----------


class Requete:
    def __init__(self, client, table):
        self.client, self.table, self.op, self.charge, self.filtres = (
            client,
            table,
            "select",
            None,
            [],
        )

    def select(self, colonnes="*"):
        self.colonnes = colonnes
        return self

    def update(self, charge):
        self.op, self.charge = "update", charge
        return self

    def insert(self, charge):
        self.op, self.charge = "insert", charge
        return self

    def eq(self, colonne, valeur):
        self.filtres.append((colonne, valeur))
        return self

    def execute(self):
        self.client.appels.append((self.table, self.op, self.charge, tuple(self.filtres)))
        if (
            self.op == "insert"
            and self.table == "tournees"
            and self.client.sans_colonne_details
            and "details" in self.charge
        ):
            raise RuntimeError('column "details" of relation "tournees" does not exist')
        data = self.client.lignes.get((self.table, self.op), [])
        if self.op == "insert" and not data:
            data = [{"id": f"t{len(self.client.appels)}"}]
        return type("R", (), {"data": data})()


class FauxClient:
    def __init__(self, lignes=None, sans_colonne_details=False):
        self.appels: list = []
        self.lignes = lignes or {}
        self.sans_colonne_details = sans_colonne_details

    def table(self, nom):
        return Requete(self, nom)

    def rpc(self, nom, charge=None):
        self.appels.append(("rpc", nom, charge, ()))
        return Requete(self, "rpc")


def test_magasin_supabase_lit_le_plan_en_place_avec_les_arrets():
    client = FauxClient({("tournees", "select"): [{"equipe_id": "e1", "arrets": []}]})
    assert MagasinSupabase(client).tournees_en_place() == [{"equipe_id": "e1", "arrets": []}]
    assert client.appels[0][:2] == ("tournees", "select")


def test_magasin_supabase_remet_les_arrets_faits_apres_la_publication():
    client = FauxClient({("tournees", "select"): [{"id": "t-e1", "equipe_id": "e1"}]})
    resultat = {
        "tournees": [
            {
                "equipe_id": "e1",
                "arrets": [
                    {"rang": 1, "fait": True, "fait_le": "2026-11-22T09:00:00+00:00"},
                    {"rang": 2, "fait": False, "fait_le": None},
                ],
            },
            {"equipe_id": "e2", "arrets": [{"rang": 1}]},
        ],
        "comparaison": {},
        "non_servis": [],
        "source_matrice": "osrm_cache",
    }
    MagasinSupabase(client).publier("d2", resultat)
    mises_a_jour = [a for a in client.appels if a[1] == "update"]
    assert len(mises_a_jour) == 1
    table, _, charge, filtres = mises_a_jour[0]
    assert table == "arrets"
    assert charge == {"fait": True, "fait_le": "2026-11-22T09:00:00+00:00"}
    assert filtres == (("tournee_id", "t-e1"), ("rang", 1))


def test_magasin_supabase_sans_arret_fait_n_ecrit_rien_de_plus():
    client = FauxClient()
    resultat = {
        "tournees": [{"equipe_id": "e1", "arrets": [{"rang": 1}]}],
        "comparaison": {},
        "non_servis": [],
        "source_matrice": "osrm_cache",
    }
    MagasinSupabase(client).publier("d2", resultat)
    assert [a[1] for a in client.appels if a[0] == "rpc" and a[1] != "select"] == [
        "publier_tournees"
    ]
    assert not [a for a in client.appels if a[1] == "update"]


@pytest.mark.parametrize("fait", [None, False])
def test_arret_non_fait_ne_cree_pas_d_exclusion(fait):
    assert (
        cles_a_exclure([{"equipe_id": "a", "arrets": [{"cle_endroit": "x", "fait": fait}]}], {"a"})
        == set()
    )


def resultat_avec_details():
    return {
        "tournees": [
            {
                "equipe_id": "e1",
                "distance_m": 1,
                "duree_s": 2,
                "debut_prevu": "a",
                "fin_prevue": "b",
                "geometrie": None,
                "depart": "position",
                "depart_position": {"latitude": 45.5, "longitude": -73.5},
                "fin": "libre",
                "fin_position": {"latitude": 45.6, "longitude": -73.6},
                "recalculee": True,
                "faits_conserves": 2,
                "arrets": [],
            },
            {
                "equipe_id": "e2",
                "distance_m": 1,
                "duree_s": 2,
                "debut_prevu": "a",
                "fin_prevue": "b",
                "geometrie": None,
                "arrets": [],
            },
        ]
    }


def test_chemin_de_repli_garde_les_details_quand_la_colonne_existe():
    client = FauxClient()
    MagasinSupabase(client).ecrire_tournees("d2", resultat_avec_details())
    inserts = [a for a in client.appels if a[0] == "tournees" and a[1] == "insert"]
    assert inserts[0][2]["details"] == {
        "depart": "position",
        "depart_position": {"latitude": 45.5, "longitude": -73.5},
        "fin": "libre",
        "fin_position": {"latitude": 45.6, "longitude": -73.6},
        "recalculee": True,
        "faits_conserves": 2,
    }
    assert "details" not in inserts[1][2]  # tournée sans détails : colonne non envoyée


def test_chemin_de_repli_sans_la_colonne_details_n_echoue_pas():
    client = FauxClient(sans_colonne_details=True)
    magasin = MagasinSupabase(client)
    resultat = resultat_avec_details()
    resultat["tournees"].insert(1, {**resultat["tournees"][0], "equipe_id": "e3"})
    magasin.ecrire_tournees("d2", resultat)
    inserts = [a for a in client.appels if a[0] == "tournees" and a[1] == "insert"]
    # Un essai avec détails, qui échoue ; puis sans détails ; ensuite la colonne n'est plus essayée.
    assert ["details" in a[2] for a in inserts] == [True, False, False, False]
    assert magasin._sans_details is True


def test_tournee_conservee_garde_ses_details_et_le_premier_niveau_les_envoie():
    from optimisation.plan_partiel import details_de, tournee_conservee

    ligne = {
        "equipe_id": "e2",
        "distance_m": 5,
        "duree_s": 6,
        "debut_prevu": "d",
        "fin_prevue": "f",
        "arrets": [],
        "details": {
            "depart": "position",
            "depart_position": {"latitude": 1, "longitude": 2},
            "fin": "garage",
            "fin_position": {"latitude": 3, "longitude": 4},
            "recalculee": True,
            "faits_conserves": 1,
            "conservee": False,
        },
    }
    t = tournee_conservee(ligne, "B")
    assert details_de(t) == {**ligne["details"], "conservee": True}
    # Sans la colonne details (migration non lancée) : seulement conservee.
    sans = tournee_conservee({k: v for k, v in ligne.items() if k != "details"}, "B")
    assert details_de(sans) == {"conservee": True}
    assert details_de({"depart": None, "fin": "libre"}) == {"fin": "libre"}


def test_la_sortie_envoie_les_details_au_premier_niveau_de_chaque_tournee():
    m = plan_complet()
    for t in m.tournees["d1"]["tournees"]:
        assert t["depart"] == "garage" and t["fin"] == "garage"
        assert set(t["depart_position"]) == {"latitude", "longitude"}
        assert set(t["fin_position"]) == {"latitude", "longitude"}
    d = demande_partielle(m, equipe_ids=["e1"])
    assert d["statut"] == "terminee"
    par = par_equipe(m.tournees["d2"])
    assert par["e1"]["recalculee"] is True and "faits_conserves" in par["e1"]
    assert par["e2"]["conservee"] is True


def plan_une_equipe(**params):
    m = MagasinPlan(
        demandes=[demande("d1", **params)],
        equipes=[{**equipe("e1", 45.50, -73.58), "fin_quart": "16:00:00"}],
        signalements=signalements(6),
    )
    traiter_demande(m, m.demandes["d1"], None, utiliser_osrm=False, journal=lambda *_: None)
    return m


def test_recalcul_de_tournee_avec_une_seule_equipe_garde_les_arrets_faits():
    m = plan_une_equipe()
    ligne = m.en_place[0]
    for a in ligne["arrets"][:2]:
        a["fait"], a["fait_le"] = True, "2026-11-22T09:00:00+00:00"
    faits = cles({"arrets": ligne["arrets"][:2]})
    restants = cles({"arrets": ligne["arrets"][2:]})
    d = demande_partielle(m, equipe_ids=["e1"], recalcul="tournee", cles_endroits=restants)
    assert d["statut"] == "terminee"
    t = m.tournees["d2"]["tournees"][0]
    assert cles(t)[:2] == faits and t["faits_conserves"] == 2 and t["recalculee"] is True
    assert [a["fait"] for a in t["arrets"][:2]] == [True, True]
    assert sorted(cles(t)[2:]) == sorted(restants)
    assert m.tournees["d2"]["portee"] == "partiel"
    assert m.tournees["d2"]["comparaison"]["portee"] == "partiel"
    # Sans ce paramètre, avec une seule équipe active, c'est un calcul global : l'historique n'est pas gardé.
    m2 = plan_une_equipe()
    for a in m2.en_place[0]["arrets"][:2]:
        a["fait"] = True
    demande_partielle(m2, equipe_ids=["e1"])
    assert m2.tournees["d2"]["portee"] == "complet"
    assert "recalculee" not in m2.tournees["d2"]["tournees"][0]


def test_recalcul_de_tournee_reprend_la_fin_en_place_et_pas_le_garage():
    libre = plan_une_equipe(fin="libre")
    assert libre.en_place[0]["details"]["fin"] == "libre"
    demande_partielle(libre, equipe_ids=["e1"], recalcul="tournee")
    assert libre.tournees["d2"]["tournees"][0]["fin"] == "libre"
    # Une fin demandée l'emporte.
    demande_partielle(libre, "d3", equipe_ids=["e1"], recalcul="tournee", fin="garage")
    assert libre.tournees["d3"]["tournees"][0]["fin"] == "garage"
    # Une fin à un endroit : on garde sa position.
    endroit = plan_une_equipe(fin="endroit", fin_cle_endroit="case:45.5200:-73.5800")
    position = endroit.en_place[0]["details"]["fin_position"]
    assert position == {"latitude": 45.52, "longitude": -73.58}
    demande_partielle(endroit, equipe_ids=["e1"], recalcul="tournee")
    t = endroit.tournees["d2"]["tournees"][0]
    assert t["fin"] == "endroit" and t["fin_position"] == position
    # Sans détails en place (colonne absente) : le garage, comme avant.
    sans = plan_une_equipe(fin="libre")
    sans.en_place[0].pop("details")
    demande_partielle(sans, equipe_ids=["e1"], recalcul="tournee")
    assert sans.tournees["d2"]["tournees"][0]["fin"] == "garage"


def test_recalcul_invalide():
    m = plan_une_equipe()
    d = demande_partielle(m, equipe_ids=["e1"], recalcul="ailleurs")
    assert d["statut"] == "echec" and d["message"] == MESSAGE_RECALCUL_INCONNU
    d = demande_partielle(m, "d3", recalcul="tournee")
    assert d["statut"] == "echec" and d["message"] == MESSAGE_RECALCUL_SANS_EQUIPE
    assert "d1" in m.tournees and "d2" not in m.tournees and "d3" not in m.tournees


def test_magasin_supabase_ne_corrige_que_les_arrets_manquants():
    client = FauxClient(
        {
            ("tournees", "select"): [{"id": "t-e1", "equipe_id": "e1"}],
            ("arrets", "select"): [{"tournee_id": "t-e1", "rang": 1}],
        }
    )
    resultat = {
        "tournees": [
            {
                "equipe_id": "e1",
                "arrets": [
                    {"rang": 1, "fait": True, "fait_le": "a"},
                    {"rang": 2, "fait": True, "fait_le": "b"},
                ],
            }
        ],
        "comparaison": {},
        "non_servis": [],
        "source_matrice": "osrm_cache",
    }
    MagasinSupabase(client).publier("d2", resultat)
    mises_a_jour = [a for a in client.appels if a[1] == "update"]
    # Le rang 1 est déjà fait (la 0006 l'a écrit) : seul le rang 2 est corrigé.
    assert [a[3] for a in mises_a_jour] == [(("tournee_id", "t-e1"), ("rang", 2))]
