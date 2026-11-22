import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Texte } from '@/components/texte';

import { DUREE_NORMALE_MS } from './reglages';

/** Une valeur qui change moins de 1,5 s après la dernière animation est remplacée directement : un texte qui bouge à chaque position GPS ne défile pas en continu. */
export const INTERVALLE_ANIMATION_MS = 1500;

/**
 * Nombre (ou durée) qui change : l'ancienne valeur glisse vers le haut et s'efface, la nouvelle monte du bas. Défilement vertical
 * court (220 ms) : la bonne valeur est affichée en moins de 300 ms, jamais un nombre faux plus longtemps. Avec « Réduire les
 * animations », la valeur change sans mouvement. Le lecteur d'écran lit toujours la valeur à jour.
 */
export function ChiffreGlissant({ valeur, style, etiquette }: { valeur: string | number; style?: StyleProp<TextStyle>; etiquette?: string }) {
  const reduit = useReducedMotion();
  const texte = String(valeur);
  const plat = StyleSheet.flatten(style) ?? {};
  const hauteur = Math.ceil(plat.lineHeight ?? (plat.fontSize ?? 16) * 1.3);
  const [affiche, setAffiche] = useState(texte);
  const [ancien, setAncien] = useState<string | null>(null);
  const progres = useSharedValue(1);
  const dernier = useRef(texte);
  const derniereAnimation = useRef(0);

  useEffect(() => {
    if (texte === dernier.current) return;
    const avant = dernier.current;
    dernier.current = texte;
    const maintenant = Date.now();
    if (reduit || maintenant - derniereAnimation.current < INTERVALLE_ANIMATION_MS) {
      // Sans animation : un seul changement d'état, la bonne valeur tout de suite.
      setAffiche(texte);
      setAncien(null);
      return;
    }
    derniereAnimation.current = maintenant;
    setAncien(avant);
    setAffiche(texte);
    progres.value = 0;
    progres.value = withTiming(1, { duration: DUREE_NORMALE_MS, easing: Easing.out(Easing.cubic) });
    const fin = setTimeout(() => setAncien(null), DUREE_NORMALE_MS + 40);
    return () => clearTimeout(fin);
  }, [texte, reduit, progres]);

  const entrant = useAnimatedStyle(() => ({ opacity: progres.value, transform: [{ translateY: (1 - progres.value) * hauteur }] }));
  const sortant = useAnimatedStyle(() => ({ opacity: 1 - progres.value, transform: [{ translateY: -progres.value * hauteur }] }));

  return (
    <View style={{ height: hauteur, overflow: 'hidden', justifyContent: 'center' }} accessible accessibilityLabel={etiquette ?? texte}>
      <Animated.View style={ancien === null ? undefined : entrant} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Texte style={[style, { height: hauteur }]}>{affiche}</Texte>
      </Animated.View>
      {ancien !== null ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sortant]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Texte style={[style, { height: hauteur }]}>{ancien}</Texte>
        </Animated.View>
      ) : null}
    </View>
  );
}
