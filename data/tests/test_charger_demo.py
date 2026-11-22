import json

import httpx
import pytest

from scripts import charger_demo

CLE = "cle-secrete-de-test"


def client_simule(journal: list, nb_exemples: int = 3):
    def gestionnaire(requete: httpx.Request) -> httpx.Response:
        journal.append(requete)
        if requete.method == "GET":
            return httpx.Response(200, headers={"content-range": f"0-0/{nb_exemples}"}, json=[])
        return httpx.Response(201 if requete.method == "POST" else 204)

    return httpx.Client(transport=httpx.MockTransport(gestionnaire))


def test_lignes_signalements_gardent_les_colonnes_de_la_table(charger):
    lignes = charger_demo.lignes_signalements(charger("signalements-demo.json"))
    assert len(lignes) == 264
    assert set(lignes[0]) == set(charger_demo.COLONNES_SIGNALEMENT)
    assert "origine" not in lignes[0] and all(r["exemple_demo"] is True for r in lignes)


def test_lignes_equipes_suivent_la_table(charger):
    lignes = charger_demo.lignes_equipes(charger("equipes-demo.json"))
    assert len(lignes) == 4
    assert [r["id"] for r in lignes] == [
        r["id"] for r in charger_demo.lignes_equipes(charger("equipes-demo.json"))
    ]
    assert len({r["id"] for r in lignes}) == 4
    for r in lignes:
        assert 45.40 <= r["garage_latitude"] <= 45.71 and -73.98 <= r["garage_longitude"] <= -73.47
        assert (
            r["fin_quart"] > r["debut_quart"] and r["exemple_demo"] is True and len(r["nom"]) <= 60
        )


def test_charger_par_lots_sans_doublon_et_sans_fuite_de_cle(charger):
    journal: list = []
    charge = charger_demo.Charge("https://x.supabase.co/", CLE, client_simule(journal, 264))
    total = charger_demo.charger(
        charge, charger("signalements-demo.json"), charger("equipes-demo.json"), False
    )
    posts = [r for r in journal if r.method == "POST"]
    assert [str(r.url).split("/rest/v1/")[1].split("?")[0] for r in posts] == [
        "equipes",
        "signalements",
        "signalements",
        "signalements",
    ]
    assert all(r.url.params["on_conflict"] == "id" for r in posts)
    assert all("ignore-duplicates" in r.headers["prefer"] for r in posts)
    assert sum(len(json.loads(r.content)) for r in posts if "signalements" in str(r.url)) == 264
    assert all(CLE not in str(r.url) and CLE not in r.content.decode() for r in journal)
    assert total == {"signalements": 264, "equipes": 264}
    assert not [r for r in journal if r.method == "DELETE"]


def test_reinitialiser_efface_les_exemples_seulement(charger):
    journal: list = []
    charge = charger_demo.Charge("https://x.supabase.co", CLE, client_simule(journal))
    charger_demo.charger(charge, [], {"garages": [], "equipes": []}, True)
    suppressions = [r for r in journal if r.method == "DELETE"]
    assert [r.url.path for r in suppressions] == ["/rest/v1/signalements", "/rest/v1/equipes"]
    assert all(r.url.params["exemple_demo"] == "eq.true" for r in suppressions)


def test_erreur_http_sans_cle():
    charge = charger_demo.Charge(
        "https://x.supabase.co",
        CLE,
        httpx.Client(
            transport=httpx.MockTransport(
                lambda r: httpx.Response(401, text="corps secret", headers={"x-secret": "entete"})
            )
        ),
    )
    with pytest.raises(RuntimeError) as erreur:
        charge.inserer("equipes", [{"id": "1"}])
    message = str(erreur.value)
    assert message == "insertion dans equipes : HTTP 401"
    assert CLE not in message and "secret" not in message


def test_lire_env(tmp_path):
    f = tmp_path / ".env.local"
    f.write_text('# note\nSUPABASE_URL="https://x.supabase.co"\n\nSUPABASE_SERVICE_ROLE_KEY=abc\n')
    assert charger_demo.lire_env(f) == {
        "SUPABASE_URL": "https://x.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "abc",
    }
    with pytest.raises(SystemExit):
        charger_demo.lire_env(tmp_path / "absent")
