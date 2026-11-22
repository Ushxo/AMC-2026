import type { Feature, MultiPolygon, Point, Polygon, Position } from 'geojson';

import type { CoucheGrilles, Coordonnees, ProprietesGrille } from '../types';
import { BOITE_MONTREAL, RAYON_AVIS_POINT_M, type Region } from './config';

const RAYON_TERRE_M = 6371000;

function rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function distanceM(a: Coordonnees, b: Coordonnees): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function dansAnneau(p: Coordonnees, anneau: Position[]): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    const croise =
      yi > p.latitude !== yj > p.latitude &&
      p.longitude < ((xj - xi) * (p.latitude - yi)) / (yj - yi) + xi;
    if (croise) dedans = !dedans;
  }
  return dedans;
}

function dansPolygone(p: Coordonnees, anneaux: Position[][]): boolean {
  if (anneaux.length === 0 || !dansAnneau(p, anneaux[0])) return false;
  for (let i = 1; i < anneaux.length; i++) {
    if (dansAnneau(p, anneaux[i])) return false;
  }
  return true;
}

/** Polygone : le point est dedans. Point : le point est à moins de 150 m. */
export function pointDansGeometrie(
  p: Coordonnees,
  g: Point | Polygon | MultiPolygon | null | undefined,
): boolean {
  if (!g) return false;
  if (g.type === 'Point') {
    const [longitude, latitude] = g.coordinates;
    return distanceM(p, { latitude, longitude }) <= RAYON_AVIS_POINT_M;
  }
  if (g.type === 'Polygon') return dansPolygone(p, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly) => dansPolygone(p, poly));
  return false;
}

export function dansMontreal(p: Coordonnees): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude >= BOITE_MONTREAL.latMin &&
    p.latitude <= BOITE_MONTREAL.latMax &&
    p.longitude >= BOITE_MONTREAL.lngMin &&
    p.longitude <= BOITE_MONTREAL.lngMax
  );
}

/** Grille la plus proche à moins de rayonM mètres, sinon null. */
export function grillePlusProche(
  p: Coordonnees,
  grilles: CoucheGrilles,
  rayonM: number,
): Feature<Point, ProprietesGrille> | null {
  let meilleure: Feature<Point, ProprietesGrille> | null = null;
  let min = Infinity;
  for (const f of grilles.features) {
    const [longitude, latitude] = f.geometry.coordinates;
    const d = distanceM(p, { latitude, longitude });
    if (d <= rayonM && d < min) {
      min = d;
      meilleure = f;
    }
  }
  return meilleure;
}

export function dansRegion(p: Coordonnees, r: Region): boolean {
  return (
    Math.abs(p.latitude - r.latitude) <= r.latitudeDelta / 2 &&
    Math.abs(p.longitude - r.longitude) <= r.longitudeDelta / 2
  );
}
