import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { centreRegion, chargerRegion } from '../lib/officiel';
import type { Coordonnees } from '../types';

type Permission = 'accordee' | 'refusee' | 'inconnue';

const CENTRE_DEMO: Coordonnees = centreRegion(chargerRegion());

export function usePosition(): {
  position: Coordonnees | null;
  permission: Permission;
  demander: () => Promise<void>;
  chargement: boolean;
  erreur: string | null;
} {
  const [position, setPosition] = useState<Coordonnees | null>(null);
  const [permission, setPermission] = useState<Permission>('inconnue');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lirePosition = useCallback(async () => {
    try {
      const p = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      setErreur(null);
    } catch {
      setPosition(CENTRE_DEMO);
      setErreur('Position introuvable : la carte montre le centre-ville.');
    }
  }, []);

  const demander = useCallback(async () => {
    setChargement(true);
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.granted) {
        setPermission('accordee');
        await lirePosition();
      } else {
        setPermission('refusee');
        setPosition(CENTRE_DEMO);
      }
    } catch {
      setPermission('refusee');
      setPosition(CENTRE_DEMO);
    } finally {
      setChargement(false);
    }
  }, [lirePosition]);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const r = await Location.getForegroundPermissionsAsync();
        if (!actif) return;
        if (r.granted) {
          setPermission('accordee');
          await lirePosition();
        } else if (r.status === 'denied' && !r.canAskAgain) {
          setPermission('refusee');
          setPosition(CENTRE_DEMO);
        }
      } catch {
        if (actif) setPosition(CENTRE_DEMO);
      }
    })();
    return () => {
      actif = false;
    };
  }, [lirePosition]);

  return { position, permission, demander, chargement, erreur };
}
