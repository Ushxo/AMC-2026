import { AppState } from 'react-native';

import { abonnerStatutCanal, canalConnecte } from './canal-partage';
import { essayerSansBruit } from './trace';

export const RELEVE_LENTE_MS = 30000;
export const RELEVE_RAPIDE_MS = 5000;

/** L'app est-elle au premier plan ? (Vrai si on ne sait pas.) */
export function auPremierPlan(): boolean {
  const e = AppState?.currentState;
  return typeof e !== 'string' || e === 'active';
}

/**
 * Relève périodique d'une source. Lente quand le canal Realtime de la table est connecté, rapide seulement en repli
 * (canal coupé ou jamais connecté). Arrêtée quand l'app passe en arrière-plan, et relancée avec une lecture au retour.
 * Rend la fonction d'arrêt.
 */
export function demarrerReleve(options: {
  table: string;
  lire: () => void;
  lentMs?: number;
  rapideMs?: number;
}): () => void {
  const { table, lire, lentMs = RELEVE_LENTE_MS, rapideMs = RELEVE_RAPIDE_MS } = options;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let actif = true;

  const arreter = () => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
  };
  const planifier = () => {
    arreter();
    if (!actif || !auPremierPlan()) return;
    minuteur = setTimeout(() => {
      minuteur = null;
      essayerSansBruit(lire, 'relève');
      planifier();
    }, canalConnecte(table) ? lentMs : rapideMs);
  };

  const abonnement = AppState?.addEventListener?.('change', (e: string) => {
    if (e === 'active') {
      essayerSansBruit(lire, 'relève'); // retour au premier plan : on relit tout de suite
      planifier();
    } else {
      arreter();
    }
  });
  // À appeler après l'abonnement au canal : son état change, on replanifie.
  const arretStatut = abonnerStatutCanal(table, planifier);
  planifier();

  return () => {
    actif = false;
    arreter();
    arretStatut();
    abonnement?.remove?.();
  };
}
