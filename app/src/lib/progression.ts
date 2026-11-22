import type { StatutDemande } from '../types';

export type EtapeProgression = 'envoi' | 'en_attente' | 'en_cours' | 'terminee' | 'echec' | 'precalcule' | 'trace';

/** Durée attendue d'un calcul mesuré : limite du solveur (8 s) + lecture, matrices et publication. */
export const DUREE_ATTENDUE_MS = 7000;
export const FRACTION_MAX_AVANT_FIN = 0.95;

export const LIBELLES_ETAPE: Record<EtapeProgression, string> = {
  envoi: 'Envoi de la demande…',
  en_attente: 'Demande envoyée',
  en_cours: 'Calcul en cours',
  terminee: 'Tournées prêtes',
  trace: 'Tracé des rues',
  echec: 'Le calcul a échoué',
  precalcule: 'Résultat précalculé',
};

/** Les étapes affichées dans l'ordre, avec la position de l'étape courante. */
export const ETAPES_AFFICHEES: EtapeProgression[] = ['en_attente', 'en_cours', 'terminee', 'trace'];

export function etapeDepuisStatut(
  statut: StatutDemande | null,
  options: { envoi?: boolean; tracesEnAttente?: boolean; precalcule?: boolean } = {},
): EtapeProgression {
  if (options.precalcule) return 'precalcule';
  if (statut === null) return options.envoi ? 'envoi' : 'precalcule';
  if (statut === 'echec' || statut === 'remplacee') return 'echec';
  if (statut === 'terminee') return options.tracesEnAttente ? 'trace' : 'terminee';
  if (statut === 'en_cours') return 'en_cours';
  return 'en_attente';
}

/**
 * Fraction entre 0 et 1 : le temps écoulé sur la durée attendue, jamais 100 % avant le vrai résultat
 * (plafonnée à 0,95 tant que la demande n'est pas terminée).
 */
export function calculerFraction(etape: EtapeProgression, ecouleMs: number): number {
  if (etape === 'terminee' || etape === 'trace') return 1;
  if (etape === 'echec' || etape === 'precalcule') return 0;
  const brut = Math.max(0, ecouleMs) / DUREE_ATTENDUE_MS;
  return Math.min(FRACTION_MAX_AVANT_FIN, brut * FRACTION_MAX_AVANT_FIN);
}
