import { useCallback, useEffect, useRef, useState } from 'react';

import { abonnerPositions, lirePositionsEquipes } from '../lib/equipe-compte';
import { etatSource } from '../lib/source';
import type { PositionEquipe } from '../types';

const INTERROGATION_MS = 10000;

/** Dernière position de chaque équipe (Realtime, avec relecture toutes les 10 s). Vide si la table n'existe pas encore. */
export function usePositionsEquipes(actif: boolean = true): { positions: PositionEquipe[]; disponible: boolean } {
  const [positions, setPositions] = useState<PositionEquipe[]>([]);
  const [disponible, setDisponible] = useState(false);
  const vivant = useRef(true);

  const lire = useCallback(async () => {
    if (etatSource() === 'repli') return;
    const l = await lirePositionsEquipes();
    if (!vivant.current) return;
    if (l) {
      setPositions(l);
      setDisponible(true);
    } else {
      setDisponible(false);
    }
  }, []);

  useEffect(() => {
    vivant.current = true;
    if (!actif) return;
    const depart = setTimeout(() => void lire(), 0);
    const arret = abonnerPositions(() => void lire());
    const minuteur = setInterval(() => void lire(), INTERROGATION_MS);
    return () => {
      vivant.current = false;
      clearTimeout(depart);
      clearInterval(minuteur);
      arret();
    };
  }, [actif, lire]);

  return { positions, disponible };
}
