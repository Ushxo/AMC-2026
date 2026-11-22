"""Matrices pour un problème quelconque : cache OSRM de Data pour les paires connues, sinon vol d'oiseau."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from optimisation.entrees import OUT
from optimisation.incident import penalites_incident
from optimisation.modeles import Incident, Lieu

DETOUR = 1.3
VITESSE_VOL_OISEAU_KMH = 20.0  # valeur du contrat
TOLERANCE_DEG = 2e-5  # deux positions plus proches que cela sont le même lieu (environ 2 m)


def vol_oiseau_m(a: Lieu, b: Lieu) -> float:
    p1, p2 = math.radians(a.latitude), math.radians(b.latitude)
    dl = math.radians(b.longitude - a.longitude)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


@dataclass(frozen=True)
class Cache:
    ids: list[str]
    positions: list[tuple[float, float]]
    temps_s: list[list[int]]
    distance_m: list[list[int]]
    permis: list[dict[str, Any]]
    rayon_m: float
    plafond_s: int
    penalite_arret_s: dict[str, int]
    source: str
    index: dict[str, int] = field(default_factory=dict)

    def trouver(self, lieu: Lieu) -> int | None:
        # Un endroit « grille:<id> » est le puisard de même identifiant dans le cache (la position moyenne
        # des signalements est proche du puisard mais pas identique) ; les garages se reconnaissent à leur position.
        i = self.index.get(lieu.id.removeprefix("grille:"))
        if i is not None:
            return i
        for i, (lat, lng) in enumerate(self.positions):
            if (
                abs(lat - lieu.latitude) <= TOLERANCE_DEG
                and abs(lng - lieu.longitude) <= TOLERANCE_DEG
            ):
                return i
        return None


def charger_cache(dossier: Path = OUT) -> Cache | None:
    try:
        m = json.loads((dossier / "matrice.json").read_text(encoding="utf-8"))
        p = json.loads((dossier / "penalites.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    regle = p.get("regle", {})
    return Cache(
        ids=[x["id"] for x in m["points"]],
        positions=[(x["latitude"], x["longitude"]) for x in m["points"]],
        temps_s=m["durees_s"],
        distance_m=m["distances_m"],
        permis=p.get("permis", []),
        rayon_m=float(regle.get("rayon_m", 30)),
        plafond_s=int(regle.get("plafond_paire_s", 600)),
        penalite_arret_s={k: int(v) for k, v in p.get("penalite_arret_s", {}).items()},
        source=m.get("source", "osrm"),
        index={x["id"]: i for i, x in enumerate(m["points"])},
    )


def construire_matrices(
    lieux: list[Lieu], cache: Cache | None
) -> tuple[list[list[int]], list[list[int]], list[list[int]], str]:
    """Rend (temps_s, distance_m, penalites_chantiers_s, source). Source « vol_oiseau » si une paire en dépend."""
    n = len(lieux)
    ref = [cache.trouver(l) if cache else None for l in lieux]
    temps = [[0] * n for _ in range(n)]
    dist = [[0] * n for _ in range(n)]
    vol = False
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if ref[i] is not None and ref[j] is not None:
                temps[i][j] = int(cache.temps_s[ref[i]][ref[j]])
                dist[i][j] = int(cache.distance_m[ref[i]][ref[j]])
            else:
                vol = True
                d = vol_oiseau_m(lieux[i], lieux[j]) * DETOUR
                dist[i][j] = round(d)
                temps[i][j] = round(d / (VITESSE_VOL_OISEAU_KMH / 3.6))
    pen = [[0] * n for _ in range(n)]
    if cache:
        for permis in cache.permis:
            if not permis.get("penalite_s"):
                continue
            zone = Incident(
                permis["latitude"], permis["longitude"], cache.rayon_m, int(permis["penalite_s"])
            )
            une = penalites_incident(lieux, [zone])
            for i in range(n):
                for j in range(n):
                    pen[i][j] = min(cache.plafond_s, pen[i][j] + une[i][j])
    source = (
        "vol_oiseau"
        if vol
        else ("osrm_cache" if cache and cache.source == "osrm" else "vol_oiseau")
    )
    return temps, dist, pen, source
