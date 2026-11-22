import { useJetons } from '@/marque/utiliser';

/**
 * Les jetons de couleur de la marque courante (organisation, thème et lisibilité). Tout ce qui porte une couleur d'interface les lit ici :
 * changer de marque ou de thème recolore tout l'écran en direct.
 */
export function useTheme() {
  return useJetons();
}
