import type { Arret, EtapeSuivi, ResultatOptimisation, Signalement, SuiviSignalement } from '../types';
import { arrondirQuartHeure } from './temps';

/** Arrêt qui porte ce signalement dans un résultat, avec le rang de l'arrêt. */
export function trouverArret(resultat: ResultatOptimisation | null, signalementId: string): Arret | null {
  if (!resultat) return null;
  for (const t of resultat.tournees) {
    const a = t.arrets.find((x) => x.signalement_ids.includes(signalementId));
    if (a) return a;
  }
  return null;
}

/**
 * Étape de suivi vue par le citoyen : l'état du signalement d'abord (réglé, rejeté, pris en charge),
 * puis « planifié » s'il figure dans une tournée, sinon « reçu ». Aucun nom d'équipe ni de membre.
 */
export function calculerSuivi(
  signalement: Pick<Signalement, 'etat' | 'etat_change_le' | 'cree_le'> | null,
  arret: Pick<Arret, 'rang' | 'arrivee_prevue'> | null,
  precalcule: boolean,
  calculeLe?: string | null,
): SuiviSignalement {
  if (signalement && signalement.etat !== 'nouveau') {
    const etape: EtapeSuivi = signalement.etat;
    return { etape, heure_estimee: null, rang: null, depuis: signalement.etat_change_le, precalcule: false };
  }
  if (arret) {
    return {
      etape: 'planifie',
      heure_estimee: arrondirQuartHeure(arret.arrivee_prevue),
      rang: arret.rang,
      depuis: calculeLe ?? null,
      precalcule,
    };
  }
  return { etape: 'recu', heure_estimee: null, rang: null, depuis: signalement?.cree_le ?? null, precalcule: false };
}
