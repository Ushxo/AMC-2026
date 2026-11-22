import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appuyable } from '@/components/appuyable';
import { VOILE_FEUILLE } from '@/components/ville/style';

import { DUREE_NORMALE_MS, RESSORT_DOUX } from './reglages';

/** Distance de départ de la feuille (en points) : elle monte depuis le bas avec un ressort doux. */
const DECALAGE_DEPART = 320;

/** Part de la hauteur de la fenêtre qu'une feuille peut occuper (sous la zone sûre du haut). */
export const PART_HAUTEUR_MAX = 0.9;

/** Hauteur du clavier quand il est ouvert (0 sinon) : la feuille remonte au-dessus de lui. */
function useHauteurClavier(): number {
  const [hauteur, setHauteur] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const montre = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHauteur(e.endCoordinates.height));
    const cache = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHauteur(0));
    return () => {
      montre.remove();
      cache.remove();
    };
  }, []);
  return hauteur;
}

/**
 * Fenêtre du bas avec une apparition soignée : le voile s'estompe, la feuille monte avec un ressort doux et un fondu, puis
 * redescend à la fermeture. Remplace `<Modal animationType="slide">` : on y met la feuille seule (les `children`), le voile
 * est inclus (un toucher dessus appelle `onFermer`). Avec « Réduire les animations », elle apparaît et disparaît sans mouvement.
 *
 * Elle impose elle-même le plafond de hauteur (90 % de la fenêtre moins la zone sûre du haut, moins le clavier s'il est ouvert) à la
 * feuille donnée en enfant : une feuille ne dépasse JAMAIS l'écran, son contenu défile à l'intérieur (la feuille doit contenir un
 * ScrollView ou une FlatList). Elle remonte aussi au-dessus du clavier. Aucun `maxHeight` en pourcentage n'est nécessaire chez l'enfant.
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
  const { height: hauteurFenetre } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const clavier = useHauteurClavier();
  const plafond = Math.max(160, Math.min(PART_HAUTEUR_MAX * hauteurFenetre - top, hauteurFenetre - top - clavier));
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
        <View style={[styles.bas, { paddingBottom: clavier }]} pointerEvents="box-none">
          <Animated.View style={[feuille, { maxHeight: plafond }]}>{avecPlafond(children, plafond)}</Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/** Donne à la feuille (l'enfant direct) le plafond en points et le droit de rétrécir : son contenu défile au lieu de déborder. */
function avecPlafond(enfant: ReactNode, plafond: number): ReactNode {
  if (!isValidElement(enfant)) return enfant;
  const element = enfant as ReactElement<{ style?: StyleProp<ViewStyle> }>;
  return cloneElement(element, { style: [element.props.style, { maxHeight: plafond, flexShrink: 1 }] });
}

const styles = StyleSheet.create({
  bas: { flex: 1, justifyContent: 'flex-end' },
});
