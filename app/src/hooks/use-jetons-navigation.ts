import { useMemo } from 'react';

import type { Jetons } from '../marque/jetons';
import { jetonsDuTheme } from '../marque/magasin';
import { useMarque } from '../marque/utiliser';
import { useThemeCarte } from './use-theme-carte';

/**
 * Jetons du panneau et du bandeau de navigation : ceux du thème de l'app, sauf quand la CARTE est sombre alors que le thème est clair
 * (style de carte réglé sur Sombre) : le panneau prend alors le thème Nuit pour se fondre avec la carte.
 */
export function useJetonsNavigation(): Jetons {
  const { jetons, sombre, organisation, lisibilite } = useMarque();
  const carteSombre = useThemeCarte() === 'dark';
  return useMemo(() => (carteSombre && !sombre ? jetonsDuTheme(organisation, 'nuit', lisibilite) : jetons), [carteSombre, sombre, organisation, lisibilite, jetons]);
}
