import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';


import { Appuyable } from '@/components/appuyable';
import { DUREE_BREVE_MS } from '@/components/mouvement/reglages';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

/** Durée d'affichage de la coche de réussite. */
export const DUREE_SUCCES_MS = 500;

/**
 * L'action principale d'un écran : grand bouton arrondi de la couleur d'action de la marque (texte lisible garanti par le contraste des jetons).
 * Une seule par écran ; hauteur 60, rayon 30, retour visuel à l'appui.
 */
export function BoutonAction({
  titre,
  onPress,
  actif = true,
  occupe = false,
  succes = false,
  libelleAccessible,
  style,
}: {
  titre: string;
  onPress: () => void;
  actif?: boolean;
  occupe?: boolean;
  /** L'appelant le passe à vrai quand l'action a réussi : une coche s'affiche une demi-seconde. */
  succes?: boolean;
  libelleAccessible?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const reduit = useReducedMotion();
  // La coche de réussite reste une demi-seconde, puis le bouton revient à son état.
  const [coche, setCoche] = useState(false);
  useEffect(() => {
    if (!succes) return;
    const debut = setTimeout(() => setCoche(true), 0);
    const fin = setTimeout(() => setCoche(false), DUREE_SUCCES_MS);
    return () => {
      clearTimeout(debut);
      clearTimeout(fin);
    };
  }, [succes]);
  const desactive = !actif || occupe;
  const etat = coche ? 'succes' : occupe ? 'occupe' : 'repos';
  const contenu =
    etat === 'succes' ? (
      <Ionicons name="checkmark" size={28} color={P.onAction} accessible={false} />
    ) : (
      <View style={styles.contenu}>
        {etat === 'occupe' ? <ActivityIndicator color={P.onAction} /> : null}
        <ThemedText style={styles.texte} maxFontSizeMultiplier={1.2}>
          {titre}
        </ThemedText>
      </View>
    );
  return (
    <Appuyable
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? titre}
      accessibilityState={{ disabled: desactive, busy: occupe }}
      disabled={desactive}
      onPress={onPress}
      style={[styles.bouton, desactive && { opacity: 0.5 }, style]}>
      {/* Passage en douceur entre les états (libellé, en cours, réussite) : fondu croisé dans une zone de hauteur fixe, rien ne saute. */}
      <View style={styles.zone}>
        {reduit ? (
          contenu
        ) : (
          <Animated.View key={etat} entering={FadeIn.duration(DUREE_BREVE_MS)} exiting={FadeOut.duration(DUREE_BREVE_MS)} style={styles.couche}>
            {contenu}
          </Animated.View>
        )}
      </View>
    </Appuyable>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    bouton: { minHeight: 60, borderRadius: 30, backgroundColor: P.action, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    contenu: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    zone: { minHeight: 28, minWidth: 28, alignItems: 'center', justifyContent: 'center' },
    couche: { alignItems: 'center', justifyContent: 'center' },
    texte: { color: P.onAction, fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  });
