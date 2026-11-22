import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  calculerFraction,
  etapeDepuisStatut,
  LIBELLES_ETAPE,
  type EtapeProgression,
} from '../lib/progression';
import type { DemandeOptimisation } from '../types';

const PAS_FLUIDE_MS = 250;
const PAS_REDUIT_MS = 1000;

/**
 * Progression d'un calcul : étapes tirées du statut réel de la demande, puis une fraction qui avance avec le temps
 * écoulé (jamais 100 % avant le vrai résultat). Avec la réduction des animations, la barre avance par paliers d'une seconde.
 */
export function useProgressionOptimisation(
  demande: DemandeOptimisation | null,
  options: { envoi?: boolean; tracesEnAttente?: boolean; precalcule?: boolean } = {},
): { etape: EtapeProgression; fraction: number; libelle: string; reduireMouvement: boolean } {
  const [maintenant, setMaintenant] = useState(0);
  const [debut, setDebut] = useState(0);
  const [reduire, setReduire] = useState(false);

  useEffect(() => {
    let actif = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => actif && setReduire(Boolean(v)))
      .catch(() => {}); // réglage d'accessibilité illisible : on garde les animations par défaut
    const abonne = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduire(v));
    return () => {
      actif = false;
      abonne?.remove?.();
    };
  }, []);

  // Le temps écoulé repart de zéro à chaque nouvelle demande.
  const id = demande?.id ?? null;
  useEffect(() => {
    const depart = setTimeout(() => {
      const t = Date.now();
      setDebut(t);
      setMaintenant(t);
    }, 0);
    return () => clearTimeout(depart);
  }, [id]);

  const etape = etapeDepuisStatut(demande?.statut ?? null, options);
  const actifEnCalcul = etape === 'envoi' || etape === 'en_attente' || etape === 'en_cours';

  useEffect(() => {
    if (!actifEnCalcul) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), reduire ? PAS_REDUIT_MS : PAS_FLUIDE_MS);
    return () => clearInterval(minuteur);
  }, [actifEnCalcul, reduire]);

  const fraction = calculerFraction(etape, debut === 0 ? 0 : maintenant - debut);
  return { etape, fraction, libelle: LIBELLES_ETAPE[etape], reduireMouvement: reduire };
}
