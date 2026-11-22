import { useCallback, useMemo, useState } from 'react';

import { bouchesVisibles, idsAvecSignalement, type BoucheExistante } from '../lib/bouches';
import type { Region } from '../lib/config';
import type { Endroit } from '../types';
import { useCouches } from './use-couches';

/** Bouches existantes (grises) de la zone visible. À brancher sur onRegionChangeComplete de la carte. */
export function useBouchesExistantes(endroits: Endroit[]): {
  bouches: BoucheExistante[];
  surRegion: (r: Region) => void;
} {
  const { couches } = useCouches();
  const [region, setRegion] = useState<Region | null>(null);
  const exclues = useMemo(() => idsAvecSignalement(endroits), [endroits]);
  const bouches = useMemo(
    () => bouchesVisibles(couches.grilles, region, exclues),
    [couches.grilles, region, exclues],
  );
  const surRegion = useCallback((r: Region) => setRegion(r), []);
  return { bouches, surRegion };
}
