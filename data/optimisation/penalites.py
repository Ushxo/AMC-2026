"""Pénalités de temps par arc : chantiers (fichier de Data) et incidents (point et rayon)."""

from __future__ import annotations

from optimisation.incident import penalites_incident
from optimisation.modeles import Probleme


def penalites_totales(p: Probleme) -> list[list[int]]:
    n = len(p.lieux)
    pen = [[0] * n for _ in range(n)]
    sources = [p.penalites_s] if p.penalites_s else []
    if p.incidents:
        sources.append(penalites_incident(p.lieux, p.incidents))
    for s in sources:
        for i in range(n):
            for j in range(n):
                pen[i][j] += int(s[i][j])
    return pen
