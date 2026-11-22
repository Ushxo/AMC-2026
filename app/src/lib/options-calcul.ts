import type { Equipe, ParametresOptimisation, PositionEquipe } from '../types';
import { formaterHeure } from './temps';

export type DepartEquipe = 'garage' | 'position';
export type FinEquipe = 'arrivee' | 'libre';

export type OptionsCalcul = {
  /** Choix par équipe (identifiant -> départ). Absent = garage. */
  departParEquipe: Record<string, DepartEquipe>;
  /** Choix par équipe (identifiant -> fin). Absent = adresse d'arrivée (le garage si l'équipe n'en a pas). */
  finParEquipe: Record<string, FinEquipe>;
  /** Option avancée globale : toutes les équipes finissent à un endroit choisi sur la carte. */
  finEndroit: boolean;
  finCle: string | null;
  /** Répartir le travail entre les équipes (activé par défaut) : réduit la tournée la plus longue. */
  repartir: boolean;
};

export const OPTIONS_PAR_DEFAUT: OptionsCalcul = { departParEquipe: {}, finParEquipe: {}, finEndroit: false, finCle: null, repartir: true };

/** Une position de moins de 15 minutes est « récente » : au-delà, le service prend le garage. */
export const POSITION_RECENTE_MS = 15 * 60 * 1000;

export function positionRecente(p: Pick<PositionEquipe, 'maj_le'> | undefined, maintenantMs: number): boolean {
  if (!p) return false;
  const t = Date.parse(p.maj_le);
  return Number.isFinite(t) && maintenantMs - t <= POSITION_RECENTE_MS && maintenantMs - t >= -60_000;
}

/** Paramètres à joindre à la demande : seulement ce qui s'écarte du défaut (garage au départ, adresse d'arrivée à la fin). */
export function parametresDesOptions(o: OptionsCalcul): Partial<ParametresOptimisation> {
  // « repartir » est toujours envoyé, pour ne pas dépendre du défaut du service.
  const p: Partial<ParametresOptimisation> = { repartir: o.repartir };
  const depart = Object.fromEntries(Object.entries(o.departParEquipe).filter(([, v]) => v !== 'garage'));
  if (Object.keys(depart).length > 0) p.depart_par_equipe = depart as Record<string, DepartEquipe>;
  const fin = Object.fromEntries(Object.entries(o.finParEquipe).filter(([, v]) => v !== 'arrivee'));
  if (Object.keys(fin).length > 0) p.fin_par_equipe = fin as Record<string, FinEquipe>;
  if (o.finEndroit && o.finCle) {
    p.fin = 'endroit';
    p.fin_cle_endroit = o.finCle;
  }
  return p;
}

/** Vrai si « Finir à un endroit » est choisi mais qu'aucun endroit n'a encore été touché. */
export function finIncomplete(o: OptionsCalcul): boolean {
  return o.finEndroit && !o.finCle;
}

/** « Garage : 800 rue X » ou « Garage » (sans adresse enregistrée). */
export function libelleGarage(e: Pick<Equipe, 'garage_adresse'>): string {
  return e.garage_adresse ? `Garage (${e.garage_adresse})` : 'Garage';
}

/** « Adresse d'arrivée (12 rue Y) », ou « Garage (800 rue X) » si l'équipe n'a pas d'autre adresse d'arrivée. */
export function libelleArrivee(e: Pick<Equipe, 'garage_adresse' | 'arrivee' | 'arrivee_adresse'>): string {
  if (e.arrivee) return e.arrivee_adresse ? `Adresse d'arrivée (${e.arrivee_adresse})` : "Adresse d'arrivée";
  return libelleGarage(e);
}

/** « Position actuelle » avec l'heure de la dernière position, ou la raison pour laquelle elle n'est pas disponible. */
export function aidePosition(p: Pick<PositionEquipe, 'maj_le'> | undefined, maintenantMs: number): string {
  if (!p) return 'Aucune position récente.';
  if (!positionRecente(p, maintenantMs)) return `Aucune position récente (la dernière date de ${formaterHeure(p.maj_le)}).`;
  return `Dernière position à ${formaterHeure(p.maj_le)}.`;
}

/** Résumé d'une ligne, par exemple « 3 équipes au garage, 1 à sa position ». */
export function resumeOptions(o: OptionsCalcul, equipeIds: string[]): string {
  const total = equipeIds.length;
  const aPosition = equipeIds.filter((id) => o.departParEquipe[id] === 'position').length;
  const auGarage = total - aPosition;
  const parties: string[] = [];
  if (auGarage > 0) parties.push(`${auGarage} ${auGarage > 1 ? 'équipes' : 'équipe'} au garage`);
  if (aPosition > 0) parties.push(`${aPosition} à sa position`.replace('sa position', aPosition > 1 ? 'leur position' : 'sa position'));
  const libres = equipeIds.filter((id) => o.finParEquipe[id] === 'libre').length;
  if (libres > 0) parties.push(`${libres} ${libres > 1 ? 'finissent' : 'finit'} au dernier arrêt`);
  if (o.finEndroit) parties.push('fin à un endroit choisi');
  if (!o.repartir) parties.push('travail non réparti');
  return parties.length > 0 ? parties.join(', ') : 'Aucune équipe';
}
