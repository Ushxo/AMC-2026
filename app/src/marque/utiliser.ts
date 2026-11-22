import { useMemo, useSyncExternalStore } from 'react';

import { abonnerMarque, lireMarque, type EtatMarque } from './magasin';
import type { Jetons } from './jetons';

export function useMarque(): EtatMarque {
  return useSyncExternalStore(abonnerMarque, lireMarque, lireMarque);
}

/** Les jetons de couleur de la marque courante. */
export function useJetons(): Jetons {
  return useMarque().jetons;
}

/** Styles qui dépendent de la marque : recréés quand elle change. `creer` doit être une fonction définie hors du composant. */
export function useStyles<T>(creer: (jetons: Jetons) => T): T {
  const jetons = useJetons();
  return useMemo(() => creer(jetons), [creer, jetons]);
}
