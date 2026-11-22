import { useMemo } from 'react';

import { bandesInondation, type BandeEau } from '../lib/inondation';
import { chargerAdresses } from '../lib/officiel';
import type { Signalement } from '../types';

/** Bandes d'eau sur les rues touchées (recalcul seulement si la liste de signalements change). */
export function useBandesInondation(signalements: Signalement[]): BandeEau[] {
  const adresses = useMemo(() => chargerAdresses(), []);
  return useMemo(() => bandesInondation(signalements, adresses), [signalements, adresses]);
}
