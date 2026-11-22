import * as Location from 'expo-location';
import { useCallback } from 'react';

import { dansMontreal } from '../lib/geo';
import { chargerAdresses } from '../lib/officiel';
import { chercherLocal } from '../lib/recherche';
import type { ResultatRecherche } from '../types';

const MAX = 5;

export function useRechercheAdresse(): { chercher: (texte: string) => Promise<ResultatRecherche[]> } {
  const chercher = useCallback(async (texte: string): Promise<ResultatRecherche[]> => {
    const t = texte.trim();
    if (t.length < 2) return [];
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
      // Hors ligne ou service indisponible : l'index local suffit.
    }
    return resultats;
  }, []);
  return { chercher };
}
