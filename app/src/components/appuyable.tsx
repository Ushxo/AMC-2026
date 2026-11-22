import { useState } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { DUREE_BREVE_MS, ECHELLE_PRESSE, RESSORT_VIF } from '@/components/mouvement/reglages';

/** Opacité d'une zone pressée : le changement se voit tout de suite (rendu immédiat, sans attendre l'animation). */
export const OPACITE_APPUI = 0.78;

const PressableAnime = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((etat: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Faux pour un fond qui ferme une feuille : pas de clignotement ni de réduction sur tout l'écran. */
  retour?: boolean;
};

/**
 * Pressable de l'app : un retour visible à chaque appui. L'opacité change tout de suite ; l'échelle baisse légèrement (0,97) puis
 * revient avec un retour élastique, sur le fil d'interface. Avec « Réduire les animations », il n'y a que l'opacité.
 * Rien n'est retardé : l'action part au relâchement, comme avec un Pressable ordinaire.
 */
export function Appuyable({ style, retour = true, onPressIn, onPressOut, ...rest }: Props) {
  const reduit = useReducedMotion();
  const echelle = useSharedValue(1);
  const [presse, setPresse] = useState(false);
  const anime = useAnimatedStyle(() => ({ transform: [{ scale: echelle.value }] }));
  const actif = retour && !rest.disabled;

  function enfonce(e: GestureResponderEvent) {
    setPresse(true);
    if (actif && !reduit) echelle.set(withTiming(ECHELLE_PRESSE, { duration: DUREE_BREVE_MS / 2 }));
    onPressIn?.(e);
  }
  function relache(e: GestureResponderEvent) {
    setPresse(false);
    if (!reduit) echelle.set(withSpring(1, RESSORT_VIF));
    onPressOut?.(e);
  }

  return (
    <PressableAnime
      {...rest}
      onPressIn={enfonce}
      onPressOut={relache}
      style={[typeof style === 'function' ? style({ pressed: presse }) : style, actif && presse ? { opacity: OPACITE_APPUI } : null, anime]}
    />
  );
}
