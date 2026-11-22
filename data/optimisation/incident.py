"""Incident simulé : pénalité sur les trajets dont la ligne droite passe dans le rayon (approximation)."""

from __future__ import annotations

import math

from optimisation.modeles import Incident, Lieu

_M_PAR_DEGRE_LAT = 111_320.0


def _vers_metres(lieu: Lieu, ref_lat: float, ref_lng: float) -> tuple[float, float]:
    x = (lieu.longitude - ref_lng) * _M_PAR_DEGRE_LAT * math.cos(math.radians(ref_lat))
    y = (lieu.latitude - ref_lat) * _M_PAR_DEGRE_LAT
    return x, y


def distance_point_segment_m(
    px: float, py: float, ax: float, ay: float, bx: float, by: float
) -> float:
    dx, dy = bx - ax, by - ay
    longueur2 = dx * dx + dy * dy
    t = 0.0 if longueur2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / longueur2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def penalites_incident(lieux: list[Lieu], incidents: list[Incident]) -> list[list[int]]:
    """Matrice de pénalités (secondes) ajoutée par les incidents. Les lieux sans coordonnées sont ignorés."""
    n = len(lieux)
    pen = [[0] * n for _ in range(n)]
    for inc in incidents:
        xy = [
            _vers_metres(l, inc.latitude, inc.longitude)
            if l.latitude is not None and l.longitude is not None
            else None
            for l in lieux
        ]
        for i in range(n):
            for j in range(n):
                if i == j or xy[i] is None or xy[j] is None:
                    continue
                d = distance_point_segment_m(0.0, 0.0, *xy[i], *xy[j])
                if d <= inc.rayon_m:
                    pen[i][j] += int(inc.penalite_s)
    return pen
