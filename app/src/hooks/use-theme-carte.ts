import { useMarque } from '../marque/utiliser';

/**
 * Style de la CARTE : il suit toujours le thème de l'app (sombre pour un thème sombre comme Nuit, claire pour les autres).
 * Il n'y a plus de choix séparé : un ancien choix « Claire » ou « Sombre » gardé sur le téléphone n'est jamais lu, donc ignoré.
 * Le mode clair ou sombre du téléphone n'entre jamais en jeu.
 */
export function useThemeCarte(): 'light' | 'dark' {
  const { sombre } = useMarque();
  return sombre ? 'dark' : 'light';
}
