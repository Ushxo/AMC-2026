import type { Coordonnees } from '../types';
import { distanceM } from './geo';
import { etapesDepuisOsrm, type EtapeGuidage } from './guidage';

export type Troncon = {
  points: Coordonnees[];
  distance_m: number;
  duree_s: number;
  droite: boolean;
  /** Étapes de guidage (manœuvres) : vides pour une ligne droite. */
  etapes: EtapeGuidage[];
};

const VITESSE_VILLE_MS = 30 / 3.6; // 30 km/h : estimation quand la route n'est pas connue
const DELAI_ROUTE_MS = 6000;
const URL_OSRM = 'https://router.project-osrm.org/route/v1/driving';

/** Ligne droite de a à b, avec une durée estimée. Annoncée comme telle (`droite`). */
export function tronconDroit(a: Coordonnees, b: Coordonnees): Troncon {
  const d = distanceM(a, b);
  return { points: [a, b], distance_m: d, duree_s: d / VITESSE_VILLE_MS, droite: true, etapes: [] };
}

export function tronconDepuisOsrm(corps: unknown): Troncon | null {
  const r = (corps as { routes?: { distance?: number; duration?: number; geometry?: { coordinates?: unknown } }[] } | null)
    ?.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (!r || !Array.isArray(coords) || coords.length < 2 || typeof r.distance !== 'number' || typeof r.duration !== 'number') {
    return null;
  }
  const points = coords
    .filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(([longitude, latitude]) => ({ latitude, longitude }));
  if (points.length < 2) return null;
  return { points, distance_m: r.distance, duree_s: r.duration, droite: false, etapes: etapesDepuisOsrm(corps) };
}

/** Route entre deux points (service public OSRM). Null si le réseau ou le service manque : l'appelant retombe sur la ligne droite. */
export async function lireTronconOsrm(a: Coordonnees, b: Coordonnees): Promise<Troncon | null> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_ROUTE_MS);
  try {
    const url = `${URL_OSRM}/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson&steps=true`;
    const reponse = await fetch(url, { headers: { 'User-Agent': 'signalement-mtl-demo' }, signal: controle.signal });
    if (!reponse.ok) return null;
    return tronconDepuisOsrm(await reponse.json());
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}
