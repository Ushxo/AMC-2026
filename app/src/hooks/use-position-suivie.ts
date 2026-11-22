import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { envoyerPosition } from '../lib/equipe-compte';
import { capEntre } from '../lib/navigation';
import type { Coordonnees } from '../types';

export type PartagePosition = 'envoye' | 'local' | 'non';

const DELAI_ENVOI_MS = 7000;
const DEPLACEMENT_CAP_M = 4;

/**
 * Position de l'appareil pendant le suivi du trajet (premier plan seulement : arrêt en quittant l'écran).
 * Si `equipeId` est donné et `envoyer` est vrai, la position est aussi envoyée au superviseur (au plus toutes les 7 s).
 */
export function usePositionSuivie(
  equipeId: string | null,
  envoyer: boolean,
): { position: Coordonnees | null; cap: number | null; autorisee: boolean | null; partage: PartagePosition } {
  const [position, setPosition] = useState<Coordonnees | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [autorisee, setAutorisee] = useState<boolean | null>(null);
  const derniere = useRef<Coordonnees | null>(null);
  const dernierEnvoi = useRef(0);
  const envoiVoulu = useRef({ equipeId, envoyer });
  const partage: PartagePosition = envoyer && equipeId ? 'envoye' : 'local';

  useEffect(() => {
    envoiVoulu.current = { equipeId, envoyer };
  }, [equipeId, envoyer]);

  useEffect(() => {
    let abonnement: Location.LocationSubscription | null = null;
    let vivant = true;
    (async () => {
      try {
        const droit = await Location.requestForegroundPermissionsAsync();
        if (!vivant) return;
        if (!droit.granted) {
          setAutorisee(false);
          return;
        }
        setAutorisee(true);
        const a = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          (p) => {
            if (!vivant) return;
            const nouvelle = { latitude: p.coords.latitude, longitude: p.coords.longitude };
            let capLu: number | null =
              typeof p.coords.heading === 'number' && p.coords.heading >= 0 ? p.coords.heading : null;
            const avant = derniere.current;
            if (capLu === null && avant) {
              const dx = Math.abs(nouvelle.latitude - avant.latitude) * 110540 + Math.abs(nouvelle.longitude - avant.longitude) * 78000;
              if (dx > DEPLACEMENT_CAP_M) capLu = capEntre(avant, nouvelle);
            }
            derniere.current = nouvelle;
            setPosition(nouvelle);
            if (capLu !== null) setCap(capLu);
            const { equipeId: eq, envoyer: veut } = envoiVoulu.current;
            const maintenant = Date.now();
            if (veut && eq && maintenant - dernierEnvoi.current >= DELAI_ENVOI_MS) {
              dernierEnvoi.current = maintenant;
              void envoyerPosition(eq, nouvelle, capLu);
            }
          },
        );
        if (vivant) abonnement = a;
        else a.remove();
      } catch {
        // Position impossible à suivre : l'écran affiche le message « position indisponible » (autorisee = false).
        if (vivant) setAutorisee(false);
      }
    })();
    return () => {
      vivant = false;
      abonnement?.remove();
    };
  }, []);

  return { position, cap, autorisee, partage };
}
