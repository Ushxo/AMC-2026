import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

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
 * revient avec un retour élastique. Tout se fait sur le fil d'interface (valeurs partagées) : un appui ne redessine pas le composant.
 * Avec « Réduire les animations », il n'y a que l'opacité. Rien n'est retardé : l'action part au relâchement.
 * (Un `style` fourni sous forme de fonction `({ pressed })` garde, lui seul, un état React pour `pressed`.)
 */
export function Appuyable({ style, retour = true, onPressIn, onPressOut, ...rest }: Props) {
  const reduit = useReducedMotion();
  const echelle = useSharedValue(1);
  const presse = useSharedValue(0);
  const enFonction = typeof style === 'function';
  const [etat, setEtat] = useState(false); // seulement pour un style en fonction
  const actif = retour && !rest.disabled;
  const resolu = enFonction ? style({ pressed: etat }) : style;
  // L'opacité de base vient du style de l'appelant (par exemple 0,5 quand le bouton est inactif) ; l'appui la réduit.
  const base = actif ? (StyleSheet.flatten(resolu)?.opacity ?? 1) : 1;
  const anime = useAnimatedStyle(() => ({
    opacity: base * (1 - (1 - OPACITE_APPUI) * presse.value),
    transform: [{ scale: echelle.value }],
  }));

  // Démontage pendant un appui (changement d'onglet) : rien ne reste pressé.
  useEffect(
    () => () => {
      cancelAnimation(echelle);
      presse.set(0);
      echelle.set(1);
    },
    [echelle, presse],
  );

  function enfonce(e: GestureResponderEvent) {
    if (enFonction) setEtat(true);
    if (actif) {
      presse.set(1);
      if (!reduit) echelle.set(withTiming(ECHELLE_PRESSE, { duration: DUREE_BREVE_MS / 2 }));
    }
    onPressIn?.(e);
  }
  function relache(e: GestureResponderEvent) {
    if (enFonction) setEtat(false);
    presse.set(0);
    if (!reduit) echelle.set(withSpring(1, RESSORT_VIF));
    onPressOut?.(e);
  }

  return <PressableAnime {...rest} onPressIn={enfonce} onPressOut={relache} style={actif ? [resolu, anime] : resolu} />;
}
