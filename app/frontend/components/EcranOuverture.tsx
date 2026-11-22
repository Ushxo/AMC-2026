import React from "react";
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Texte as Text } from "@/components/texte";

import { LogoMarque } from "@/components/logo-marque";
import { DUREE_NORMALE_MS, RESSORT_DOUX } from '@/components/mouvement/reglages';
import { useMarque, useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

/** Écran d'ouverture : le logo et le nom de l'organisation, puis « Propulsé par Priorix ». Se montre quand la marque du compte se prépare. */
export function EcranOuverture() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { organisation } = useMarque();
  const reduit = useReducedMotion();
  // Le logo apparaît avec une légère échelle et un fondu, puis le texte : rien d'autre.
  const logo = useSharedValue(reduit ? 1 : 0);
  const texte = useSharedValue(reduit ? 1 : 0);
  useEffect(() => {
    if (reduit) {
      logo.value = 1;
      texte.value = 1;
      return;
    }
    logo.value = withSpring(1, RESSORT_DOUX);
    texte.value = withDelay(120, withTiming(1, { duration: DUREE_NORMALE_MS }));
  }, [reduit, logo, texte]);
  const styleLogo = useAnimatedStyle(() => ({ opacity: Math.min(1, logo.value * 1.5), transform: [{ scale: 0.9 + 0.1 * logo.value }] }));
  const styleTexte = useAnimatedStyle(() => ({ opacity: texte.value }));
  return (
    <View style={styles.fond} accessibilityRole="progressbar" accessibilityLabel={`Ouverture de ${organisation.nom_app}`}>
      <View style={styles.centre}>
        <Animated.View style={styleLogo}>
          <LogoMarque taille={96} />
        </Animated.View>
        <Animated.View style={[styles.texteBloc, styleTexte]}>
          <Text style={styles.nom} accessibilityRole="header">
            Ouverture de {organisation.nom_app}…
          </Text>
          <ActivityIndicator color={P.primary} />
        </Animated.View>
      </View>
      <Text style={styles.pied}>Propulsé par Priorix</Text>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background, alignItems: "center", justifyContent: "space-between", paddingVertical: 48 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  texteBloc: { alignItems: "center", gap: 16 },
  nom: { fontSize: 20, fontWeight: "700", color: P.text, textAlign: "center" },
  pied: { fontSize: 13, color: P.textSecondary },
});
