import type { ResultatRecherche } from '../types';
import type { EntreeAdresse } from './officiel';

export function normaliser(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Cherche dans l'index local. Les adresses qui commencent par le texte passent en premier. */
export function chercherLocal(texte: string, index: EntreeAdresse[], max = 5): ResultatRecherche[] {
  const q = normaliser(texte);
  if (q.length < 2) return [];
  const debut: EntreeAdresse[] = [];
  const contient: EntreeAdresse[] = [];
  for (const e of index) {
    const l = normaliser(e.libelle);
    if (l.startsWith(q)) debut.push(e);
    else if (l.includes(q)) contient.push(e);
    if (debut.length >= max) break;
  }
  return [...debut, ...contient].slice(0, max).map((e) => ({
    libelle: e.libelle,
    position: { latitude: e.latitude, longitude: e.longitude },
    source: 'local' as const,
  }));
}

/** Adresse de l'index la plus proche d'un point (à vol d'oiseau), ou null si aucune n'est à moins de `maxM` mètres. */
export function adressePlusProche(
  p: { latitude: number; longitude: number },
  index: EntreeAdresse[],
  maxM = 200,
): { libelle: string; distance_m: number } | null {
  let meilleur: { libelle: string; distance_m: number } | null = null;
  const kx = 111320 * Math.cos((p.latitude * Math.PI) / 180);
  for (const e of index) {
    const d = Math.hypot((e.latitude - p.latitude) * 110540, (e.longitude - p.longitude) * kx);
    if (d <= maxM && (!meilleur || d < meilleur.distance_m)) meilleur = { libelle: e.libelle, distance_m: d };
  }
  return meilleur;
}
