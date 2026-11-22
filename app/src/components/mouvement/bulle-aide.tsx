import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Texte } from '@/components/texte';
import { useTheme } from '@/hooks/use-theme';

import { DUREE_BREVE_MS, RESSORT_DOUX } from './reglages';

const LARGEUR_POINTE = 16;

/**
 * Bulle d'aide qui pointe un élément : elle grandit depuis sa pointe (fondu et échelle de 0,8 à 1) et s'efface au retrait.
 * Elle ne prend aucun toucher (`pointerEvents="none"`) : le premier toucher de l'utilisateur va à l'élément visé, et l'appelant
 * ferme la bulle (voir `useAideUneFois`). Avec « Réduire les animations », elle apparaît sans mouvement.
 *
 * `style` la place (position absolue près de l'élément) ; `pointe` dit de quel côté elle pointe ; `decalagePointe` décale la
 * pointe depuis le centre de la bulle (positif : vers la droite). L'échelle part du milieu du côté de la pointe.
 *
 *   <BulleAide visible={aide.visible} texte="Touchez ici…" pointe="bas" decalagePointe={80} style={{ position: 'absolute', right: 16, bottom: 120 }} />
 */
export function BulleAide({
  visible,
  texte,
  pointe = 'bas',
  decalagePointe = 0,
  style,
}: {
  visible: boolean;
  texte: string;
  pointe?: 'bas' | 'haut';
  decalagePointe?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const P = useTheme();
  const reduit = useReducedMotion();
  const progres = useSharedValue(0);
  // Montée le temps de l'animation de sortie.
  const [monte, setMonte] = useState(visible);
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMonte(true);
      progres.value = reduit ? 1 : withSpring(1, RESSORT_DOUX);
      return;
    }
    if (reduit) {
      progres.value = 0;
      setMonte(false);
      return;
    }
    progres.value = withTiming(0, { duration: DUREE_BREVE_MS });
    const fin = setTimeout(() => setMonte(false), DUREE_BREVE_MS + 30);
    return () => clearTimeout(fin);
  }, [visible, reduit, progres]);
  const anime = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progres.value)),
    transform: [{ scale: 0.8 + 0.2 * progres.value }],
  }));
  if (!visible && !monte) return null;
  const sommet = pointe === 'haut';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.bulle,
        // La bulle grandit depuis sa pointe.
        { transformOrigin: `50% ${sommet ? '0%' : '100%'}` } as ViewStyle,
        style,
        anime,
      ]}>
      {sommet ? <View style={[styles.pointe, styles.pointeHaut, { backgroundColor: P.primary, left: '50%', marginLeft: decalagePointe - LARGEUR_POINTE / 2 }]} /> : null}
      <View style={[styles.corps, { backgroundColor: P.primary }]}>
        <Texte style={[styles.texte, { color: P.onPrimary }]} maxFontSizeMultiplier={1.3}>
          {texte}
        </Texte>
      </View>
      {!sommet ? <View style={[styles.pointe, styles.pointeBas, { backgroundColor: P.primary, left: '50%', marginLeft: decalagePointe - LARGEUR_POINTE / 2 }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bulle: { maxWidth: 260 },
  corps: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  texte: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  pointe: { width: LARGEUR_POINTE, height: LARGEUR_POINTE, transform: [{ rotate: '45deg' }], position: 'absolute' },
  pointeBas: { bottom: -6 },
  pointeHaut: { top: -6 },
});
