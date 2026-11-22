import type { Arret, Tournee } from '../types';
import { formaterNombre } from './format';
import { formaterDuree, formaterKm } from './temps';

/** « Durée totale estimée : 6 h 52 · 19,4 km · 41 arrêts » (durée du plan, trajets et passages compris). */
export function resumeTotalTournee(t: Pick<Tournee, 'duree_s' | 'distance_m' | 'arrets'>): string {
  return `Durée totale estimée : ${formaterDuree(t.duree_s)} · ${formaterKm(t.distance_m)} · ${formaterNombre(t.arrets.length, 'arrêt', 'arrêts')}`;
}

/** Total toutes équipes : durées cumulées des tournées (les équipes roulent en même temps). */
export function resumeToutesEquipes(
  tournees: Pick<Tournee, 'duree_s' | 'distance_m' | 'arrets'>[],
  totaux?: { distance_m: number; duree_s: number; arrets_servis: number } | null,
): string {
  // Les totaux du service, quand ils existent ; sinon la somme des tournées affichées.
  const duree = totaux ? totaux.duree_s : tournees.reduce((n, t) => n + t.duree_s, 0);
  const distance = totaux ? totaux.distance_m : tournees.reduce((n, t) => n + t.distance_m, 0);
  const arrets = totaux ? totaux.arrets_servis : tournees.reduce((n, t) => n + t.arrets.length, 0);
  return `Total toutes équipes : ${formaterDuree(duree)} · ${formaterKm(distance)} · ${formaterNombre(arrets, 'arrêt', 'arrêts')} (durées cumulées)`;
}

/**
 * Temps restant ESTIMÉ d'après le plan : de la fin du dernier arrêt fait (ou du début de la tournée) à la fin prévue.
 * Compte les trajets, les passages aux arrêts restants et le retour. Ce n'est pas une mesure : la route réelle peut différer.
 */
export function resteEstime(
  tournee: Pick<Tournee, 'debut_prevu' | 'fin_prevue' | 'arrets'>,
  estFait: (a: Arret) => boolean,
): { duree_s: number; arrets: number } {
  const ordre = [...tournee.arrets].sort((a, b) => a.rang - b.rang);
  const restants = ordre.filter((a) => !estFait(a));
  if (restants.length === 0) return { duree_s: 0, arrets: 0 };
  const rangRef = restants[0].rang;
  const avant = ordre.filter((a) => a.rang < rangRef);
  const depart = avant.length > 0 ? avant[avant.length - 1].depart_prevu : tournee.debut_prevu;
  const s = (Date.parse(tournee.fin_prevue) - Date.parse(depart)) / 1000;
  return { duree_s: Number.isFinite(s) ? Math.max(0, s) : 0, arrets: restants.length };
}

/** « Reste (estimé) : 5 h 10 · 30 arrêts » */
export function libelleReste(r: { duree_s: number; arrets: number }): string {
  return `Reste (estimé) : ${formaterDuree(r.duree_s)} · ${formaterNombre(r.arrets, 'arrêt', 'arrêts')}`;
}
