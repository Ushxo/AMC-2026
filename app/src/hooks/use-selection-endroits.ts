import { useCallback, useMemo, useState } from 'react';

import {
  basculerCle,
  basculerZone,
  basculerGravite,
  clesOuvertes,
  nettoyerSelection,
} from '../lib/selection';
import type { Endroit, Gravite } from '../types';

/**
 * Sélection des endroits à planifier. Par défaut : tous les endroits ouverts. Dès que l'utilisateur agit,
 * la sélection devient explicite (les endroits qui arrivent ensuite ne sont pas ajoutés d'office).
 */
export function useSelectionEndroits(endroits: Endroit[], initiales?: string[]): {
  cles: string[];
  nombre: number;
  choisirGravite: (g: Gravite) => void;
  basculer: (cle: string) => void;
  /** Toucher une zone : ajoute tous ses endroits, ou les retire si tous sont déjà choisis. */
  basculerZoneEndroits: (clesZone: string[]) => void;
  toutes: () => void;
  vider: () => void;
  estChoisi: (cle: string) => boolean;
} {
  const [explicite, setExplicite] = useState<string[] | null>(initiales ?? null);
  const cles = useMemo(
    () => (explicite === null ? clesOuvertes(endroits) : nettoyerSelection(explicite, endroits)),
    [explicite, endroits],
  );
  const ensemble = useMemo(() => new Set(cles), [cles]);

  const choisirGravite = useCallback(
    (g: Gravite) => setExplicite(basculerGravite(cles, endroits, g)),
    [cles, endroits],
  );
  const basculer = useCallback((cle: string) => setExplicite(basculerCle(cles, cle)), [cles]);
  const basculerZoneEndroits = useCallback((clesZone: string[]) => setExplicite(basculerZone(cles, clesZone)), [cles]);
  const toutes = useCallback(() => setExplicite(clesOuvertes(endroits)), [endroits]);
  const vider = useCallback(() => setExplicite([]), []);
  const estChoisi = useCallback((cle: string) => ensemble.has(cle), [ensemble]);

  return { cles, nombre: cles.length, choisirGravite, basculer, basculerZoneEndroits, toutes, vider, estChoisi };
}
