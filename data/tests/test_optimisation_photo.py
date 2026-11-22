"""Seuil d'apparition d'un endroit selon la photo : 1 signalement à photo vérifiée, ou 3 sans photo."""

import httpx
import pytest

from optimisation.endroits import (
    SEUIL_AVEC_PHOTO,
    SEUIL_SANS_PHOTO,
    endroit_apparait,
    photo_verifiee,
    regrouper_ouverts,
)
from optimisation.entrees import arrets_depuis_signalements, charger_probleme
from scripts import charger_demo


def sig(
    i, grille="g", etat="nouveau", photo="absent", cree="2026-11-20T10:00:00Z", gravite="faible"
):
    s = {
        "id": i,
        "latitude": 45.5,
        "longitude": -73.56,
        "grille_id": grille,
        "etat": etat,
        "gravite": gravite,
        "cree_le": cree,
    }
    if photo != "absent":
        s["photo_verifiee"] = photo
    return s


def cles(signalements, **kw):
    return [e.cle for e in regrouper_ouverts(signalements, **kw)]


def test_seuils_comme_dans_l_app():
    assert (SEUIL_SANS_PHOTO, SEUIL_AVEC_PHOTO) == (3, 1)


def test_un_signalement_a_photo_verifiee_suffit():
    assert cles([sig("a", photo=True)]) == ["grille:g"]


def test_un_signalement_sans_photo_est_ecarte():
    assert cles([sig("a", photo=False)]) == []


def test_deux_sans_photo_sont_ecartes_trois_sont_pris():
    deux = [sig("a", photo=False), sig("b", photo=False)]
    trois = [*deux, sig("c", photo=False)]
    assert cles(deux) == [] and cles(trois) == ["grille:g"]


def test_un_avec_photo_parmi_des_sans_photo_suffit():
    assert cles([sig("a", photo=False), sig("b", photo=True)]) == ["grille:g"]


def test_champ_absent_ou_nul_vaut_photo_verifiee():
    assert cles([sig("a")]) == ["grille:g"]
    assert cles([sig("a", photo=None)]) == ["grille:g"]
    assert photo_verifiee({}) and photo_verifiee({"photo_verifiee": None})
    assert not photo_verifiee({"photo_verifiee": False})


def test_les_signalements_fermes_ne_comptent_pas():
    # Trois signalements sans photo dont un réglé : deux ouverts seulement, donc écarté.
    s = [sig("a", photo=False), sig("b", photo=False), sig("c", photo=False, etat="regle")]
    assert cles(s) == []
    # Une photo vérifiée sur un signalement fermé ne fait pas entrer l'endroit.
    assert cles([sig("a", photo=False), sig("b", photo=True, etat="rejete")]) == []
    # Ouverts : pris en charge compte.
    assert cles([sig("a", photo=True, etat="pris_en_charge")]) == ["grille:g"]


def test_le_plancher_seuil_apparition_reste_applicable():
    assert endroit_apparait([sig("a", photo=True)], seuil=1)
    assert not endroit_apparait([sig("a", photo=True)], seuil=2)
    assert endroit_apparait([sig("a", photo=True), sig("b", photo=False)], seuil=2)
    assert not endroit_apparait([], seuil=1)


def test_plusieurs_endroits_et_gravite_inchangee():
    s = [
        sig("a", grille="g1", photo=False),
        sig("b", grille="g2", photo=True, gravite="elevee"),
        *[sig(f"x{i}", grille="g3", photo=False) for i in range(3)],
    ]
    r = {e.cle: e for e in regrouper_ouverts(s)}
    assert set(r) == {"grille:g2", "grille:g3"}
    assert r["grille:g2"].gravite == "elevee" and len(r["grille:g3"].signalement_ids) == 3


def test_arrets_du_solveur_meme_regle():
    s = [
        sig("a", grille="g1", photo=False),
        sig("b", grille="g2", photo=True),
        *[sig(f"x{i}", grille="g3", photo=False) for i in range(3)],
        sig("d", grille="g4", photo=False, etat="regle"),
    ]
    assert sorted(a.id for a in arrets_depuis_signalements(s)) == ["g2", "g3"]
    assert [a.id for a in arrets_depuis_signalements(s, seuil=2)] == ["g3"]


def test_les_donnees_de_demo_sont_toutes_confirmees_et_donnent_189_arrets(charger):
    demo = charger("signalements-demo.json")
    assert all(photo_verifiee(s) for s in demo)  # aucune n'a le champ : toutes confirmées
    assert len(charger_probleme().arrets) == 189
    assert len(regrouper_ouverts(demo)) == 189


# ---------- chargeur de démo ----------


def client_colonne(existe):
    def gestionnaire(requete: httpx.Request) -> httpx.Response:
        if requete.method == "GET" and requete.url.params.get("select") == "photo_verifiee":
            return httpx.Response(200 if existe else 400, json=[] if existe else {"code": "42703"})
        if requete.method == "GET":
            return httpx.Response(200, headers={"content-range": "0-0/1"}, json=[])
        return httpx.Response(201)

    return httpx.Client(transport=httpx.MockTransport(gestionnaire))


@pytest.mark.parametrize("existe", [True, False])
def test_chargeur_marque_la_photo_verifiee_seulement_si_la_colonne_existe(charger, existe):
    envois = []
    base = client_colonne(existe)
    transport = base._transport

    def espion(requete: httpx.Request) -> httpx.Response:
        if requete.method == "POST" and "signalements" in str(requete.url):
            envois.extend(__import__("json").loads(requete.content))
        return transport.handle_request(requete)

    client = httpx.Client(transport=httpx.MockTransport(espion))
    charge = charger_demo.Charge("https://x.supabase.co", "cle", client)
    assert charge.colonne_existe("signalements", "photo_verifiee") is existe
    charger_demo.charger(
        charge, charger("signalements-demo.json"), charger("equipes-demo.json"), False
    )
    assert len(envois) == 264
    if existe:
        assert all(e["photo_verifiee"] is True for e in envois)
    else:
        assert all("photo_verifiee" not in e for e in envois)
