import { useMemo, useSyncExternalStore } from 'react';

import { filtrerSignalements, type FiltreSignalements } from '../lib/filtre';
import {
  abonnerSignalements,
  lireEtatSignalements,
  memesSignalements,
  rafraichirSignalements,
} from '../lib/store-signalements';
import type { Signalement } from '../types';

export { memesSignalements };

/**
 * Signalements partagés entre tous les écrans : le cache est rendu tout de suite, la relecture se fait en arrière-plan.
 * « chargement » n'est vrai que tant qu'il n'y a encore aucune lecture.
 */
export function useSignalements(filtre?: FiltreSignalements): {
  signalements: Signalement[];
  rafraichir: () => Promise<void>;
  chargement: boolean;
  erreur: string | null;
} {
  const { tous, chargement, erreur } = useSyncExternalStore(
    abonnerSignalements,
    lireEtatSignalements,
    lireEtatSignalements,
  );

  const cle = JSON.stringify([filtre?.etats ?? null, filtre?.categories ?? null]);
  const signalements = useMemo(
    () => filtrerSignalements(tous, filtre),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tous, cle],
  );
  return { signalements, rafraichir: rafraichirSignalements, chargement, erreur };
}
