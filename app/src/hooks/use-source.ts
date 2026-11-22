import { useEffect, useSyncExternalStore } from 'react';

import { abonnerEtat, etatSource, sonderSource } from '../lib/source';
import type { EtatSource } from '../types';

export function useSource(): { etat: EtatSource; chargement: boolean; erreur: string | null } {
  const etat = useSyncExternalStore(abonnerEtat, etatSource, etatSource);
  useEffect(() => {
    void sonderSource();
  }, []);
  return { etat, chargement: false, erreur: null };
}
