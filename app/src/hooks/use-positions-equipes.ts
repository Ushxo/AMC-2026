import { useCallback, useEffect, useRef, useState } from 'react';

import { abonnerPositions, lirePositionsEquipes } from '../lib/equipe-compte';
import { demarrerReleve } from '../lib/releve';
import { etatSource } from '../lib/source';
import type { PositionEquipe } from '../types';

const RAPIDE_MS = 10000;

// Une seule lecture à la fois, partagée si plusieurs écrans demandent les positions en même temps.
let lectureEnCours: Promise<PositionEquipe[] | null> | null = null;
function lireUneFois(): Promise<PositionEquipe[] | null> {
  if (!lectureEnCours) {
    lectureEnCours = lirePositionsEquipes().finally(() => {
      lectureEnCours = null;
    });
  }
  return lectureEnCours;
}

/** Dernière position de chaque équipe (Realtime ; relève lente quand le canal est connecté, rapide en repli). Vide si la table n'existe pas encore. */
export function usePositionsEquipes(actif: boolean = true): { positions: PositionEquipe[]; disponible: boolean } {
  const [positions, setPositions] = useState<PositionEquipe[]>([]);
  const [disponible, setDisponible] = useState(false);
  const vivant = useRef(true);

  const lire = useCallback(async () => {
    if (etatSource() === 'repli') return;
    const l = await lireUneFois();
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
    const arretReleve = demarrerReleve({ table: 'positions_equipes', lire: () => void lire(), rapideMs: RAPIDE_MS });
    return () => {
      vivant.current = false;
      clearTimeout(depart);
      arretReleve();
      arret();
    };
  }, [actif, lire]);

  return { positions, disponible };
}
