import { useMemo } from 'react';

import type { FiltreSignalements } from '../lib/filtre';
import { regrouper, trierEndroits } from '../lib/gravite';
import type { Endroit } from '../types';
import { useSignalements } from './use-signalements';

export function useEndroits(filtre?: FiltreSignalements): {
  endroits: Endroit[];
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
} {
  const { signalements, chargement, erreur, rafraichir } = useSignalements(filtre);
  const endroits = useMemo(() => trierEndroits(regrouper(signalements)), [signalements]);
  return { endroits, chargement, erreur, rafraichir };
}
