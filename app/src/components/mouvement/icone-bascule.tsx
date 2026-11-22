import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { DUREE_BREVE_MS } from './reglages';

type Nom = keyof typeof Ionicons.glyphMap;

/**
 * Icône d'onglet à deux états (contour et pleine) : les DEUX glyphes restent montés en permanence et se fondent l'un dans l'autre
 * par une valeur partagée. Aucune vue n'est créée ni détruite au toucher (pas d'animation d'entrée ou de sortie à empiler) :
 * une rafale de touchers ne laisse rien de collé ni de doublé. L'animation en cours est annulée avant la suivante.
 * La pleine grandit légèrement (0,85 à 1) en s'activant.
 */
export function IconeBascule({ actif, nomVide, nomPlein, taille = 24, couleur }: { actif: boolean; nomVide: Nom; nomPlein: Nom; taille?: number; couleur: string }) {
  const reduit = useReducedMotion();
  const p = useSharedValue(actif ? 1 : 0);
  useEffect(() => {
    cancelAnimation(p);
    p.value = reduit ? (actif ? 1 : 0) : withTiming(actif ? 1 : 0, { duration: DUREE_BREVE_MS });
  }, [actif, reduit, p]);
  const plein = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + 0.15 * p.value }] }));
  const vide = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <View style={{ width: taille, height: taille }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, vide]}>
        <Ionicons name={nomVide} size={taille} color={couleur} accessible={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, plein]}>
        <Ionicons name={nomPlein} size={taille} color={couleur} accessible={false} />
      </Animated.View>
    </View>
  );
}
