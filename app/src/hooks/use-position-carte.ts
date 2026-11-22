import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { StatutPosition } from '../lib/position-citoyen';
import type { Coordonnees } from '../types';

/**
 * Position du citoyen pour la carte : la permission est demandée au lancement, puis la position lue une fois.
 * Contrairement à usePosition, aucune position de remplacement : sans permission ou sans position, `position` reste nul.
 */
export function usePositionCarte(): {
  position: Coordonnees | null;
  statut: StatutPosition;
  /** Redemande la permission si besoin puis relit la position. */
  actualiser: () => Promise<Coordonnees | null>;
} {
  const [etat, setEtat] = useState<{ statut: StatutPosition; position: Coordonnees | null }>({ statut: 'attente', position: null });
  const vivant = useRef(true);

  const actualiser = useCallback(async (): Promise<Coordonnees | null> => {
    try {
      const droit = await Location.requestForegroundPermissionsAsync();
      if (!droit.granted) {
        if (vivant.current) setEtat({ statut: 'refusee', position: null });
        return null;
      }
      // Dernière position connue : instantanée, la carte s'ouvre tout de suite au bon endroit ; la position fraîche affine ensuite.
      try {
        const derniere = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 });
        if (derniere && vivant.current) setEtat((avant) => (avant.position ? avant : { statut: 'ok', position: { latitude: derniere.coords.latitude, longitude: derniere.coords.longitude } }));
      } catch {
        /* pas de dernière position : on attend la fraîche */
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const position = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      if (vivant.current) setEtat({ statut: 'ok', position });
      return position;
    } catch {
      if (vivant.current) setEtat((avant) => (avant.position ? avant : { statut: 'indisponible', position: null }));
      return null;
    }
  }, []);

  useEffect(() => {
    vivant.current = true;
    const t = setTimeout(() => void actualiser(), 0);
    return () => {
      vivant.current = false;
      clearTimeout(t);
    };
  }, [actualiser]);

  return { position: etat.position, statut: etat.statut, actualiser };
}
