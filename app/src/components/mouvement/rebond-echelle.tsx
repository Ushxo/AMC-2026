import { useEffect, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { DUREE_BREVE_MS, ECHELLE_REBOND } from './reglages';

/** Léger rebond d'échelle (1 à 1,08 puis retour) au moment où `actif` devient vrai. Rien avec « Réduire les animations ». */
export function RebondEchelle({ actif, children }: { actif: boolean; children: ReactNode }) {
  const reduit = useReducedMotion();
  const echelle = useSharedValue(1);
  useEffect(() => {
    if (reduit || !actif) return;
    echelle.value = withSequence(withTiming(ECHELLE_REBOND, { duration: DUREE_BREVE_MS }), withTiming(1, { duration: DUREE_BREVE_MS }));
  }, [actif, reduit, echelle]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: echelle.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
