"""Quartier de démo : centre-ville et Vieux-Montréal (arrondissements Ville-Marie et bordure du Plateau)."""

NOM = "Centre-ville de Montréal"

# Boîte de sélection des données, en degrés WGS84.
LAT_MIN = 45.490
LAT_MAX = 45.515
LNG_MIN = -73.585
LNG_MAX = -73.550

# Région de départ de la carte (format react-native-maps).
REGION = {
    "latitude": 45.5025,
    "longitude": -73.5675,
    "latitudeDelta": 0.03,
    "longitudeDelta": 0.042,
}


def dans_quartier(latitude: float, longitude: float) -> bool:
    """Vrai si le point est dans la boîte du quartier de démo."""
    return LAT_MIN <= latitude <= LAT_MAX and LNG_MIN <= longitude <= LNG_MAX
