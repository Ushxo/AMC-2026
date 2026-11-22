import { useCallback, useMemo, useState } from 'react';

import { bouchesVisibles, idsAvecSignalement, type BoucheExistante } from '../lib/bouches';
import type { Region } from '../lib/config';
import type { Endroit } from '../types';
import { chargerRegards } from '../lib/officiel';

/** Regards d'égout existants (gris) de la zone visible. À brancher sur onRegionChangeComplete de la carte. */
export function useBouchesExistantes(endroits: Endroit[]): {
  bouches: BoucheExistante[];
  surRegion: (r: Region) => void;
} {
  const regards = useMemo(() => chargerRegards(), []);
  const [region, setRegion] = useState<Region | null>(null);
  const exclues = useMemo(() => idsAvecSignalement(endroits), [endroits]);
  const bouches = useMemo(
    () => bouchesVisibles(regards, region, exclues),
    [regards, region, exclues],
  );
  const surRegion = useCallback((r: Region) => setRegion(r), []);
  return { bouches, surRegion };
}
