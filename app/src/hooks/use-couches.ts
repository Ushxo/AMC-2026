import { useMemo } from 'react';

import { chargerCouches } from '../lib/officiel';
import type { Couches } from '../types';

export function useCouches(): { couches: Couches; chargement: boolean; erreur: string | null } {
  const couches = useMemo(() => chargerCouches(), []);
  return { couches, chargement: false, erreur: null };
}
