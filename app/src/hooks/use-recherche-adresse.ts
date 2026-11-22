import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { dansMontreal } from '../lib/geo';
import { chargerAdresses } from '../lib/officiel';
import { chercherLocal } from '../lib/recherche';
import type { ResultatRecherche } from '../types';

const MAX = 5;

export const MESSAGE_RECHERCHE_INDISPONIBLE = 'Recherche indisponible sans réseau : seules les adresses connues du quartier sont proposées.';

export function useRechercheAdresse(): {
  chercher: (texte: string) => Promise<ResultatRecherche[]>;
  /** Vrai si la dernière recherche n'a pas pu interroger le service de recherche (hors ligne ou service en panne). */
  indisponible: boolean;
} {
  const [indisponible, setIndisponible] = useState(false);
  const chercher = useCallback(async (texte: string): Promise<ResultatRecherche[]> => {
    const t = texte.trim();
    if (t.length < 2) return [];
    setIndisponible(false);
    const resultats = chercherLocal(t, chargerAdresses(), MAX);
    if (resultats.length >= MAX) return resultats;
    try {
      const trouves = await Location.geocodeAsync(`${t}, Montréal, Québec`);
      for (const g of trouves) {
        const position = { latitude: g.latitude, longitude: g.longitude };
        if (dansMontreal(position) && resultats.length < MAX) {
          resultats.push({ libelle: t, position, source: 'telephone' });
        }
      }
    } catch {
      // Hors ligne ou service en panne : l'index local reste utilisé, et l'écran dit que la recherche est limitée.
      setIndisponible(true);
    }
    return resultats;
  }, []);
  return { chercher, indisponible };
}
