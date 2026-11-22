import { useMemo } from 'react';

import type { FiltreSignalements } from '../lib/filtre';
import { estConfirme, regrouper, trierEndroits } from '../lib/gravite';
import type { Endroit, Signalement } from '../types';
import { useSignalements } from './use-signalements';

/** Par défaut, seuls les endroits confirmés (assez de signalements, ou une photo vérifiée). `tout: true` rend aussi les autres. */
export function useEndroits(
  filtre?: FiltreSignalements,
  options: { tout?: boolean } = {},
): {
  endroits: Endroit[];
  signalements: Signalement[];
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
} {
  const { signalements, chargement, erreur, rafraichir } = useSignalements(filtre);
  const tout = Boolean(options.tout);
  const endroits = useMemo(() => {
    const tous = trierEndroits(regrouper(signalements));
    return tout ? tous : tous.filter(estConfirme);
  }, [signalements, tout]);
  return { endroits, signalements, chargement, erreur, rafraichir };
}
