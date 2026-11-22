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
