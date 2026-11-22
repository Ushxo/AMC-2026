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

// Les styles d'un composant sont construits une seule fois par thème et partagés par toutes ses instances (les lignes d'une liste
// ne reconstruisent plus chacune leur feuille de styles). La clé est la fonction de styles (définie hors du composant) puis les jetons.
const cacheStyles = new WeakMap<object, WeakMap<object, unknown>>();

/** Styles qui dépendent de la marque : recréés quand elle change, partagés entre les instances. `creer` doit être une fonction définie hors du composant. */
export function useStyles<T>(creer: (jetons: Jetons) => T): T {
  const jetons = useJetons();
  return useMemo(() => {
    let parJetons = cacheStyles.get(creer);
    if (!parJetons) {
      parJetons = new WeakMap();
      cacheStyles.set(creer, parJetons);
    }
    if (parJetons.has(jetons)) return parJetons.get(jetons) as T;
    const styles = creer(jetons);
    parJetons.set(jetons, styles);
    return styles;
  }, [creer, jetons]);
}
