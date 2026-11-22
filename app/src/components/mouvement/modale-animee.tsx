import { useEffect, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Appuyable } from '@/components/appuyable';
import { VOILE_FEUILLE } from '@/components/ville/style';

import { DUREE_NORMALE_MS, RESSORT_DOUX } from './reglages';

/** Distance de départ de la feuille (en points) : elle monte depuis le bas avec un ressort doux. */
const DECALAGE_DEPART = 320;

/**
 * Fenêtre du bas avec une apparition soignée : le voile s'estompe, la feuille monte avec un ressort doux et un fondu, puis
 * redescend à la fermeture. Remplace `<Modal animationType="slide">` : on y met la feuille seule (les `children`), le voile
 * est inclus (un toucher dessus appelle `onFermer`). Avec « Réduire les animations », elle apparaît et disparaît sans mouvement.
 *
 *   <ModaleAnimee visible={ouvert} onFermer={() => setOuvert(false)}>
 *     <View style={styles.feuille}>…</View>
 *   </ModaleAnimee>
 */
export function ModaleAnimee({
  visible,
  onFermer,
  children,
  libelleFermer = 'Fermer',
}: {
  visible: boolean;
  onFermer: () => void;
  children: ReactNode;
  /** Étiquette lue pour le voile qui ferme la fenêtre. */
  libelleFermer?: string;
}) {
  const reduit = useReducedMotion();
  // La fenêtre reste montée le temps de l'animation de sortie.
  const [monte, setMonte] = useState(visible);
  const progres = useSharedValue(visible ? 1 : 0);

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
    progres.value = withTiming(0, { duration: DUREE_NORMALE_MS, easing: Easing.out(Easing.cubic) });
    const fin = setTimeout(() => setMonte(false), DUREE_NORMALE_MS + 30);
    return () => clearTimeout(fin);
  }, [visible, reduit, progres]);

  const voile = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progres.value)) }));
  const feuille = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progres.value * 1.4)),
    transform: [{ translateY: (1 - progres.value) * DECALAGE_DEPART }],
  }));

  if (!monte && !visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onFermer} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: VOILE_FEUILLE }, voile]}>
          <Appuyable retour={false} style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityRole="button" accessibilityLabel={libelleFermer} />
        </Animated.View>
        <View style={styles.bas} pointerEvents="box-none">
          <Animated.View style={feuille}>{children}</Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bas: { flex: 1, justifyContent: 'flex-end' },
});
