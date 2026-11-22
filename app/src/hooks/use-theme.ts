import { useJetons } from '@/marque/utiliser';

/**
 * Les jetons de couleur de la marque courante (organisation + apparence). Tout ce qui porte une couleur d'interface les lit ici :
 * changer de marque ou d'apparence recolore tout l'écran en direct.
 */
export function useTheme() {
  return useJetons();
}
