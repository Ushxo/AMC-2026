import { useEffect, useRef } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { RESSORT_DOUX } from './reglages';

export type CiblePastille = { x: number; y: number; largeur: number; hauteur: number };

/**
 * Pastille de l'onglet actif : elle GLISSE d'un onglet à l'autre avec un ressort doux. Au premier affichage, elle se pose sans
 * mouvement ; avec « Réduire les animations », elle saute directement. Le mouvement se fait sur le fil d'interface.
 * À placer en premier dans la barre (derrière les onglets), en position absolue.
 */
export function PastilleGlissante({ cible, style, testID }: { cible: CiblePastille | null; style?: StyleProp<ViewStyle>; testID?: string }) {
  const reduit = useReducedMotion();
  const x = useSharedValue(cible?.x ?? 0);
  const largeur = useSharedValue(cible?.largeur ?? 0);
  const premiere = useRef(true);
  useEffect(() => {
    if (!cible) return;
    if (premiere.current || reduit) {
      premiere.current = false;
      x.value = cible.x;
      largeur.value = cible.largeur;
      return;
    }
    x.value = withSpring(cible.x, RESSORT_DOUX);
    largeur.value = withSpring(cible.largeur, RESSORT_DOUX);
  }, [cible, reduit, x, largeur]);
  const anime = useAnimatedStyle(() => ({ width: largeur.value, transform: [{ translateX: x.value }] }));
  if (!cible) return null;
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: cible.y, left: 0, height: cible.hauteur }, style, anime]}
    />
  );
}
