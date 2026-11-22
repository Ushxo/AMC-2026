import json
import math

from scripts import avis_troncons, reseau_routier


def props(**kw):
    base = {"ID_TRC": 1, "TYP_VOIE": "rue", "LIE_VOIE": None, "NOM_VOIE": "Test", "DIR_VOIE": None}
    return {**base, **kw}


def feature(id_, coords, **kw):
    return {
        "type": "Feature",
        "properties": props(ID_TRC=id_, **kw),
        "geometry": {"type": "LineString", "coordinates": coords},
    }


EMPRISE = {
    "latitudeMin": 45.50,
    "latitudeMax": 45.52,
    "longitudeMin": -73.58,
    "longitudeMax": -73.55,
}


def test_libelle_et_nom_normalise_comme_l_index_d_adresses():
    p = props(TYP_VOIE="rue", LIE_VOIE="du", NOM_VOIE="Shannon")
    assert reseau_routier.libelle(p) == "rue du Shannon"
    assert reseau_routier.nom_normalise(p) == "rue du shannon"
    p = props(TYP_VOIE="rue", NOM_VOIE="Sainte-Catherine", DIR_VOIE="Ouest")
    assert reseau_routier.nom_normalise(p) == "rue sainte-catherine ouest"
    p = props(TYP_VOIE="avenue", LIE_VOIE="de l'", NOM_VOIE="Hôtel-de-Ville")
    assert reseau_routier.libelle(p) == "avenue de l' Hôtel-de-Ville"
    assert reseau_routier.nom_normalise(p) == "avenue de l' hotel-de-ville"
    assert reseau_routier.normaliser("  Éléphant ") == "elephant"
    assert reseau_routier.libelle(props(TYP_VOIE=None, NOM_VOIE=None)) == ""


def test_simplifier_garde_les_extremites_et_reste_a_2_m():
    # Une droite avec un écart de 0,5 m au milieu : un seul segment ; un coude de 30 m : gardé.
    droite = [[-73.57, 45.50], [-73.5699, 45.500002], [-73.5698, 45.50]]
    assert len(reseau_routier.simplifier(droite)) == 2
    coude = [[-73.57, 45.50], [-73.57, 45.5003], [-73.5698, 45.5003]]
    assert len(reseau_routier.simplifier(coude)) == 3
    for ligne in (droite, coude):
        s = reseau_routier.simplifier(ligne)
        assert s[0] == ligne[0] and s[-1] == ligne[-1]
    # Arrondi à 6 décimales.
    s = reseau_routier.simplifier([[-73.5700004, 45.5000004], [-73.5600004, 45.5100004]])
    assert s == [[-73.57, 45.5], [-73.56, 45.51]]
    assert reseau_routier.simplifier([[-73.5, 45.5]]) == [[-73.5, 45.5]]


def test_simplification_ne_deplace_pas_a_plus_de_2_m():
    lat0 = 45.5
    k = math.cos(math.radians(lat0)) * 111_320
    points = [[-73.57 + i * 0.00004, 45.5 + 0.00002 * math.sin(i / 3)] for i in range(60)]
    simple = reseau_routier.simplifier(points)
    assert len(simple) < len(points)
    for x, y in points:
        d = min(
            reseau_routier._distance_polyligne_m(simple, y, x, k / 111_320),
            1e9,
        )
        assert d <= 2.2


def test_emprise_couvre_les_donnees_avec_une_marge(tmp_path):
    (tmp_path / "grilles.geojson").write_text(
        json.dumps({"features": [{"geometry": {"type": "Point", "coordinates": [-73.60, 45.47]}}]})
    )
    (tmp_path / "signalements-demo.json").write_text(
        json.dumps([{"latitude": 45.53, "longitude": -73.50}])
    )
    e = reseau_routier.emprise_donnees(tmp_path)
    assert e["latitudeMin"] < 45.47 and e["latitudeMax"] > 45.53
    assert e["longitudeMin"] < -73.60 and e["longitudeMax"] > -73.50
    # Sans fichier : le quartier de démo et sa marge.
    vide = reseau_routier.emprise_donnees(tmp_path / "rien")
    assert vide["latitudeMin"] < reseau_routier.quartier.LAT_MIN


def test_construire_filtre_l_emprise_ignore_les_sans_nom_et_range_dans_la_grille():
    source = {
        "features": [
            feature(30, [[-73.57, 45.51], [-73.57, 45.5101]], NOM_VOIE="Dedans"),
            feature(10, [[-73.50, 45.51], [-73.499, 45.51]], NOM_VOIE="Dehors"),
            feature(20, [[-73.57, 45.505], [-73.569, 45.505]], NOM_VOIE=None, TYP_VOIE=None),
            feature(5, [[-73.575, 45.505], [-73.565, 45.505]], NOM_VOIE="Longue", LIE_VOIE="de la"),
        ]
    }
    r = reseau_routier.construire(source, EMPRISE)
    assert [t["id"] for t in r["troncons"]] == [5, 30]
    assert (
        r["troncons"][0]["nom"] == "rue de la longue"
        and r["troncons"][0]["libelle"] == "rue de la Longue"
    )
    assert r["emprise"] == EMPRISE and r["grille"]["pas"] == 0.002 and r["version"] == 1
    assert (
        r["source"]["ressource"] == reseau_routier.RESSOURCE
        and "CC BY 4.0" in r["source"]["licence"]
    )
    # La longue rue (0,01 degré de large) est rangée dans plusieurs cases.
    cases_longue = [c for c, v in r["cases"].items() if 0 in v]
    assert len(cases_longue) >= 5
    json.dumps(r)


def reseau_de_test():
    return reseau_routier.construire(
        {
            "features": [
                feature(1, [[-73.570, 45.510], [-73.570, 45.512]], TYP_VOIE="rue", NOM_VOIE="Nord"),
                feature(
                    2, [[-73.570, 45.5100], [-73.566, 45.5100]], TYP_VOIE="avenue", NOM_VOIE="Est"
                ),
                feature(
                    3, [[-73.575, 45.503], [-73.5749, 45.503]], TYP_VOIE="rue", NOM_VOIE="Loin"
                ),
            ]
        },
        EMPRISE,
    )


def test_troncon_le_plus_proche_dans_la_case_et_les_voisines():
    r = reseau_de_test()
    t, d = reseau_routier.troncon_le_plus_proche(r, 45.5111, -73.57008)
    assert t["id"] == 1 and d < 8
    t, d = reseau_routier.troncon_le_plus_proche(r, 45.50995, -73.568)
    assert t["id"] == 2 and d < 10
    # À 120 m d'un tronçon : encore trouvé (garantie de 150 m) ; très loin : rien.
    t, d = reseau_routier.troncon_le_plus_proche(r, 45.5111, -73.5683)
    assert t is not None
    assert reseau_routier.troncon_le_plus_proche(r, 45.5195, -73.5505) is None
    # Avec un nom de rue.
    t, _ = reseau_routier.troncon_le_plus_proche(r, 45.5101, -73.5700, nom="avenue est")
    assert t["id"] == 2
    assert reseau_routier.troncon_le_plus_proche(r, 45.5101, -73.5700, nom="rue inconnue") is None


def test_fichier_produit(charger):
    r = charger("troncons.json")
    assert (reseau_routier.SORTIE.stat().st_size) < reseau_routier.TAILLE_MAX
    ids = [t["id"] for t in r["troncons"]]
    assert ids == sorted(set(ids)) and len(ids) > 1000
    e = r["emprise"]
    for t in r["troncons"]:
        assert t["nom"] and t["libelle"] and len(t["points"]) >= 2
        assert t["nom"] == reseau_routier.normaliser(t["libelle"])
        for lng, lat in t["points"]:
            assert round(lng, 6) == lng and round(lat, 6) == lat
        assert any(
            e["latitudeMin"] - 0.01 <= lat <= e["latitudeMax"] + 0.01 for _, lat in t["points"]
        )
    assert all(0 <= i < len(ids) for v in r["cases"].values() for i in v)
    assert r["source"]["ressource"] == reseau_routier.RESSOURCE


def test_les_rues_de_l_index_d_adresses_sont_dans_le_reseau(charger):
    r = charger("troncons.json")
    noms = {t["nom"] for t in r["troncons"]}
    rues = {avis_troncons.nom_de_rue(a["libelle"]) for a in charger("adresses.json")}
    absentes = rues - noms
    assert len(absentes) <= 0.02 * len(rues), absentes


def test_les_puisards_sont_pres_d_un_troncon(charger):
    r = charger("troncons.json")
    grilles = charger("grilles.geojson")["features"][::40]
    proches = 0
    for f in grilles:
        lng, lat = f["geometry"]["coordinates"]
        trouve = reseau_routier.troncon_le_plus_proche(r, lat, lng)
        if trouve and trouve[1] <= 30:
            proches += 1
    assert proches >= 0.9 * len(grilles)


# ---------- rattachement des avis d'eau ----------


def reseau_avis():
    return reseau_routier.construire(
        {
            "features": [
                # Rue principale en deux tronçons, carrefour avec une rue transversale courte.
                feature(
                    1,
                    [[-73.5700, 45.5100], [-73.5690, 45.5100]],
                    TYP_VOIE="rue",
                    NOM_VOIE="Principale",
                ),
                feature(
                    2,
                    [[-73.5690, 45.5100], [-73.5680, 45.5100]],
                    TYP_VOIE="rue",
                    NOM_VOIE="Principale",
                ),
                feature(
                    3,
                    [[-73.5690, 45.5100], [-73.5690, 45.5105]],
                    TYP_VOIE="rue",
                    NOM_VOIE="Transversale",
                ),
                feature(
                    4,
                    [[-73.5690, 45.5100], [-73.5690, 45.5090]],
                    TYP_VOIE="rue",
                    NOM_VOIE="Transversale",
                ),
                feature(
                    5, [[-73.5700, 45.5200], [-73.5690, 45.5200]], TYP_VOIE="rue", NOM_VOIE="Autre"
                ),
            ]
        },
        EMPRISE,
    )


def source_avis(geometrie):
    return {
        "features": [
            {
                "type": "Feature",
                "geometry": geometrie,
                "properties": {"titre": "Avis A", "date_debut": "2026-11-10"},
            }
        ]
    }


def avis_a():
    return {"features": [{"properties": {"id": "7", "titre": "Avis A", "debut": "2026-11-10"}}]}


def test_ligne_rattachee_a_la_rue_principale_sans_les_bouts_transversaux():
    # La ligne de l'avis longe la rue Principale, décalée de 8 m, de part et d'autre du carrefour.
    ligne = {"type": "LineString", "coordinates": [[-73.5700, 45.51007], [-73.5680, 45.51007]]}
    [e] = avis_troncons.rattacher(avis_a(), source_avis(ligne), reseau_avis(), [])
    assert e["id"] == "7" and e["forme"] == "ligne"
    assert e["troncons"] == [1, 2] and e["rues"] == ["rue Principale"]
    assert e["trace"] == [[-73.57, 45.51007], [-73.568, 45.51007]] and e["polygone"] is None


def test_ligne_courte_ne_ramene_pas_la_transversale():
    ligne = {"type": "LineString", "coordinates": [[-73.5693, 45.51004], [-73.5687, 45.51004]]}
    [e] = avis_troncons.rattacher(avis_a(), source_avis(ligne), reseau_avis(), [])
    assert 3 not in e["troncons"] and 4 not in e["troncons"]
    assert set(e["troncons"]) <= {1, 2} and e["troncons"]


def test_ligne_loin_de_tout_ne_donne_aucun_troncon():
    ligne = {"type": "LineString", "coordinates": [[-73.5600, 45.5150], [-73.5590, 45.5150]]}
    [e] = avis_troncons.rattacher(avis_a(), source_avis(ligne), reseau_avis(), [])
    assert e["troncons"] == [] and e["forme"] == "ligne"


def test_point_rattache_au_troncon_de_sa_rue_puis_au_plus_proche():
    adresses = [{"libelle": "1 rue Principale", "latitude": 45.51, "longitude": -73.57}]
    avis = {
        "features": [
            {"properties": {"id": "7", "titre": "Avis A – 1 rue Principale", "debut": "2026-11-10"}}
        ]
    }
    point = {"type": "Point", "coordinates": [-73.5691, 45.51003]}
    source = {
        "features": [
            {
                "type": "Feature",
                "geometry": point,
                "properties": {"titre": "Avis A – 1 rue Principale", "date_debut": "2026-11-10"},
            }
        ]
    }
    [e] = avis_troncons.rattacher(avis, source, reseau_avis(), adresses)
    # Au carrefour, le tronçon de la rue de l'adresse l'emporte sur la transversale (aussi proche).
    assert e["forme"] == "point" and e["troncons"] and e["rues"] == ["rue Principale"]
    assert e["point"] == [-73.5691, 45.51003]
    # Loin de tout tronçon : aucun.
    loin = {"type": "Point", "coordinates": [-73.5500, 45.5150]}
    [e] = avis_troncons.rattacher(avis_a(), source_avis(loin), reseau_avis(), [])
    assert e["troncons"] == []


def test_polygone_officiel_garde_tel_quel():
    secteur = {
        "type": "Polygon",
        "coordinates": [
            [
                [-73.5702, 45.5099],
                [-73.5678, 45.5099],
                [-73.5678, 45.5101],
                [-73.5702, 45.5101],
                [-73.5702, 45.5099],
            ]
        ],
    }
    [e] = avis_troncons.rattacher(avis_a(), source_avis(secteur), reseau_avis(), [])
    assert e["forme"] == "polygone" and e["polygone"] == secteur and e["trace"] is None
    assert e["troncons"] == [1, 2]


def test_avis_absent_de_la_source_ignore():
    assert avis_troncons.rattacher(avis_a(), {"features": []}, reseau_avis(), []) == []


def test_nom_de_rue_de_l_adresse():
    assert (
        avis_troncons.nom_de_rue("1700 avenue du Docteur-Penfield") == "avenue du docteur-penfield"
    )
    assert avis_troncons.nom_de_rue("141-151 rue du Shannon") == "rue du shannon"


def test_fichier_des_avis_produit(charger):
    f = charger("avis-eau-troncons.json")
    ids_reseau = {t["id"] for t in charger("troncons.json")["troncons"]}
    avis = {x["properties"]["id"] for x in charger("avis-eau.geojson")["features"]}
    assert {e["id"] for e in f["avis"]} == avis
    for e in f["avis"]:
        assert e["forme"] in ("ligne", "point", "polygone")
        assert set(e["troncons"]) <= ids_reseau
        assert (e["trace"] is not None) == (e["forme"] == "ligne")
        assert (e["polygone"] is not None) == (e["forme"] == "polygone")
        assert (e["point"] is not None) == (e["forme"] == "point")
    avec_troncons = sum(1 for e in f["avis"] if e["troncons"])
    assert avec_troncons >= 0.9 * len(f["avis"])
