from scripts import quartier


def test_boite_dans_montreal():
    assert 45.40 <= quartier.LAT_MIN < quartier.LAT_MAX <= 45.71
    assert -73.98 <= quartier.LNG_MIN < quartier.LNG_MAX <= -73.47


def test_region_centree_sur_la_boite():
    r = quartier.REGION
    assert quartier.dans_quartier(r["latitude"], r["longitude"])


def test_dans_quartier():
    assert quartier.dans_quartier(45.505, -73.57)
    assert not quartier.dans_quartier(45.60, -73.57)
