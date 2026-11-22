import { useMemo } from 'react';

import { calculerZonesMemo, type Zone } from '../lib/zones';
import type { Signalement } from '../types';

/** Zones de signalements calculées sur les signalements actifs (recalcul seulement si la liste change). */
export function useZonesSignalements(signalements: Signalement[]): Zone[] {
  return useMemo(() => calculerZonesMemo(signalements), [signalements]);
}
