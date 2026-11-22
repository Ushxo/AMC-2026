import { useCallback } from 'react';

import { changerEtat, lireHistorique } from '../lib/source';
import type { ChangementEtat, Etat } from '../types';

export function useChangerEtat(): {
  changer: (id: string, etat: Etat) => Promise<string | null>;
  historique: (id: string) => Promise<ChangementEtat[]>;
} {
  const changer = useCallback((id: string, e: Etat) => changerEtat(id, e), []);
  const historique = useCallback((id: string) => lireHistorique(id), []);
  return { changer, historique };
}
