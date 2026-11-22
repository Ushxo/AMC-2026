import type { AvisEau, Coordonnees } from '../types';
import { projeterSurPolyligne, tronconParId, type DonneesTroncons } from './troncons';

export type InfoAvis = {
  id: string;
  forme: 'ligne' | 'point' | 'polygone';
  troncons: number[];
  rues: string[];
  trace: [number, number][] | null;
};

/** Un avis en ligne se touche à cette distance du tracé (en mètres) ; la valeur vient du fichier des avis. */
export const TOLERANCE_AVIS_LIGNE_M = 25;

let cache: Map<string, InfoAvis> | null | undefined;

/** Pour chaque avis, la forme officielle (ligne de rue, point ou secteur) et les tronçons de rue touchés. Chargé au premier besoin. */
export function chargerInfoAvis(): Map<string, InfoAvis> {
  if (cache) return cache;
  const m = new Map<string, InfoAvis>();
  try {
    const brut = require('../donnees/avis-eau-troncons.json');
    for (const a of Array.isArray(brut?.avis) ? brut.avis : []) {
      if (a && typeof a.id === 'string' && (a.forme === 'ligne' || a.forme === 'point' || a.forme === 'polygone')) {
        m.set(a.id, { id: a.id, forme: a.forme, troncons: Array.isArray(a.troncons) ? a.troncons : [], rues: Array.isArray(a.rues) ? a.rues : [], trace: Array.isArray(a.trace) ? a.trace : null });
      }
    }
  } catch {
    // Fichier absent : les avis gardent leur forme officielle d'origine.
  }
  cache = m;
  return m;
}

export function infoAvis(a: AvisEau, info: Map<string, InfoAvis> = chargerInfoAvis()): InfoAvis | undefined {
  return info.get(a.properties.id);
}

/**
 * Les tracés à dessiner pour un avis en ligne (ou en point) : les tronçons de rue touchés, en trait épais. Pas de tracé pour un secteur officiel
 * (son polygone est dessiné tel quel) ; sans tronçon, la ligne officielle elle-même.
 */
export function tracesAvis(a: AvisEau, info: Map<string, InfoAvis> = chargerInfoAvis(), donnees?: DonneesTroncons | null): Coordonnees[][] | null {
  const i = infoAvis(a, info);
  if (!i || i.forme === 'polygone') return null;
  const lignes: [number, number][][] = [];
  for (const id of i.troncons) {
    const t = donnees === undefined ? tronconParId(id) : tronconParId(id, donnees);
    if (t) lignes.push(t.points);
  }
  if (lignes.length === 0 && i.trace && i.trace.length >= 2) lignes.push(i.trace);
  if (lignes.length === 0) return null;
  return lignes.map((l) => l.map(([longitude, latitude]) => ({ longitude, latitude })));
}

/** Distance du point au tracé d'un avis en ligne, ou null si l'avis n'a pas de tracé (secteur). */
export function distanceTraceAvisM(p: Coordonnees, a: AvisEau, info?: Map<string, InfoAvis>, donnees?: DonneesTroncons | null): number | null {
  const traces = tracesAvis(a, info, donnees);
  if (!traces) return null;
  let d = Infinity;
  for (const tr of traces) d = Math.min(d, projeterSurPolyligne(p, tr.map((c) => [c.longitude, c.latitude] as [number, number])).distanceM);
  return d;
}
