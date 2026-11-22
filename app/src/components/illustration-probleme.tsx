import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import type { Categorie } from '@/types';

const IMAGES: Record<Categorie, number> = {
  grille_bouchee: require('../../assets/images/categories/egout-bouche.png'),
  eau_accumulee: require('../../assets/images/categories/accumulation-eau.png'),
  affaissement: require('../../assets/images/categories/affaissement.png'),
  grille_endommagee: require('../../assets/images/categories/grille-endommagee.png'),
  eau_douteuse: require('../../assets/images/categories/autre.png'),
  absence_eau: require('../../assets/images/categories/autre.png'),
  autre: require('../../assets/images/categories/autre.png'),
};

/**
 * Illustration d'un type de problème (images fournies, fond transparent). Décorative par défaut : le titre à côté
 * dit déjà le problème ; le parent peut passer `accessibilityLabel` pour la rendre lisible seule.
 */
export function IllustrationProbleme({
  categorie,
  taille,
  style,
  accessibilityLabel,
}: {
  categorie: Categorie;
  taille: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={IMAGES[categorie]}
      contentFit="contain"
      style={[{ width: taille, height: taille }, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
