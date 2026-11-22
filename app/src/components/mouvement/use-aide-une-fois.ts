import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIXE = 'priorix:aide:';
/** L'aide disparaît d'elle-même après ce délai si personne ne la ferme. */
export const DUREE_AIDE_MS = 12000;
/** Petit délai avant l'apparition : la carte a le temps de s'afficher. */
export const DELAI_AIDE_MS = 800;

const dejaMontrees = new Set<string>(); // garde la mémoire pour la session si le stockage échoue

/**
 * Une aide montrée une seule fois : visible à la première ouverture, puis plus jamais (mémorisé sur le téléphone dès qu'elle
 * s'affiche). `fermer()` la retire (à appeler au premier toucher) ; sans toucher, elle disparaît après 12 s.
 */
export function useAideUneFois(cle: string, actif: boolean = true): { visible: boolean; fermer: () => void } {
  const [visible, setVisible] = useState(false);
  const fermer = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!actif || dejaMontrees.has(cle)) return;
    let vivant = true;
    let depart: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      let vue = false;
      try {
        vue = (await AsyncStorage.getItem(PREFIXE + cle)) !== null;
      } catch {
        vue = false; // stockage illisible : montrée une fois pour cette session
      }
      if (!vivant || vue || dejaMontrees.has(cle)) return;
      dejaMontrees.add(cle);
      try {
        await AsyncStorage.setItem(PREFIXE + cle, '1');
      } catch {
        // pas de stockage : la mémoire de session suffit
      }
      if (!vivant) return;
      depart = setTimeout(() => vivant && setVisible(true), DELAI_AIDE_MS);
    })();
    return () => {
      vivant = false;
      if (depart) clearTimeout(depart);
    };
  }, [cle, actif]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), DUREE_AIDE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  return { visible, fermer };
}

export function reinitialiserAides(): void {
  dejaMontrees.clear();
}
