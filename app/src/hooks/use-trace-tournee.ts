import { useMemo } from 'react';

import { pointsTournee } from '../lib/tournees';
import type { Coordonnees, Equipe, Tournee } from '../types';

/** Tracé du plan d'une tournée : de son départ à son arrivée (garage, position, adresse d'arrivée de l'équipe). */
export function useTraceTournee(tournee: Tournee | null, equipe: Pick<Equipe, 'garage' | 'arrivee'> | null): Coordonnees[] {
  const garage = equipe?.garage ?? null;
  const arrivee = equipe?.arrivee ?? null;
  return useMemo(() => (tournee ? pointsTournee(tournee, garage, arrivee) : []), [tournee, garage, arrivee]);
}
