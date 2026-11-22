import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn, FadeOut } from 'react-native-reanimated';

import { DUREE_BREVE_MS, DUREE_NORMALE_MS } from './reglages';

type Nom = keyof typeof Ionicons.glyphMap;

/**
 * Icône qui change d'état en douceur : l'ancienne s'efface (fondu), la nouvelle arrive avec une légère échelle.
 * Le cadre garde la taille de l'icône : rien ne bouge autour. Avec « Réduire les animations », le changement est immédiat.
 */
export function IconeAnimee({ nom, taille = 24, couleur }: { nom: Nom; taille?: number; couleur: string }) {
  const reduit = useReducedMotion();
  if (reduit) {
    return <Ionicons name={nom} size={taille} color={couleur} accessible={false} />;
  }
  return (
    <View style={{ width: taille, height: taille }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View key={nom} entering={ZoomIn.duration(DUREE_NORMALE_MS)} exiting={FadeOut.duration(DUREE_BREVE_MS)} style={{ position: 'absolute', width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={nom} size={taille} color={couleur} accessible={false} />
      </Animated.View>
    </View>
  );
}
