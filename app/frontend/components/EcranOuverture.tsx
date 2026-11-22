import React from "react";
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Texte as Text } from "@/components/texte";

import { LogoMarque } from "@/components/logo-marque";
import { useMarque, useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

/** Écran d'ouverture : le logo et le nom de l'organisation, puis « Propulsé par Priorix ». Se montre quand la marque du compte se prépare. */
export function EcranOuverture() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { organisation } = useMarque();
  return (
    <View style={styles.fond} accessibilityRole="progressbar" accessibilityLabel={`Ouverture de ${organisation.nom_app}`}>
      <View style={styles.centre}>
        <LogoMarque taille={96} />
        <Text style={styles.nom} accessibilityRole="header">
          Ouverture de {organisation.nom_app}…
        </Text>
        <ActivityIndicator color={P.primary} />
      </View>
      <Text style={styles.pied}>Propulsé par Priorix</Text>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background, alignItems: "center", justifyContent: "space-between", paddingVertical: 48 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  nom: { fontSize: 20, fontWeight: "700", color: P.text, textAlign: "center" },
  pied: { fontSize: 13, color: P.textSecondary },
});
