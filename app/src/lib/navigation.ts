import type { Coordonnees } from '../types';
import { distanceM } from './geo';

/** Cap (0 à 360, 0 = nord) pour aller de a vers b. */
export function capEntre(a: Coordonnees, b: Coordonnees): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLng = rad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(rad(b.latitude));
  const x =
    Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) -
    Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Distance (m) d'un point au tracé : le plus proche de ses sommets, ou de ses segments (approximation plane locale). */
export function distanceAuTrace(p: Coordonnees, trace: Coordonnees[]): number {
  if (trace.length === 0) return Infinity;
  if (trace.length === 1) return distanceM(p, trace[0]);
  const kx = Math.cos((p.latitude * Math.PI) / 180) * 111320;
  const ky = 110540;
  let mini = Infinity;
  for (let i = 0; i < trace.length - 1; i++) {
    const ax = (trace[i].longitude - p.longitude) * kx;
    const ay = (trace[i].latitude - p.latitude) * ky;
    const bx = (trace[i + 1].longitude - p.longitude) * kx;
    const by = (trace[i + 1].latitude - p.latitude) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < mini) mini = d;
  }
  return mini;
}

/** « 350 m » ou « 1,2 km ». */
export function distanceCourte(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 1000) return `${Math.round(m / 10) * 10 || 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** « environ 2 min » (jamais moins d'une minute). */
export function dureeCourte(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `environ ${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return `environ ${h} h${r > 0 ? ` ${String(r).padStart(2, '0')}` : ''}`;
}

export const DELAI_MIN_ROUTE_MS = 10000;
export const ECART_RECALCUL_M = 50;

/** Faut-il redemander la route ? Au nouvel arrêt (si 10 s écoulées ou premier appel) ou si l'équipe s'écarte de plus de 50 m. */
export function doitRecalculer(p: {
  dernierEnvoiMs: number | null;
  maintenantMs: number;
  arriveeChangee: boolean;
  ecartM: number;
}): boolean {
  if (p.dernierEnvoiMs === null) return true;
  if (p.maintenantMs - p.dernierEnvoiMs < DELAI_MIN_ROUTE_MS) return false;
  return p.arriveeChangee || p.ecartM > ECART_RECALCUL_M;
}
