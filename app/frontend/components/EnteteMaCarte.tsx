import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoutonProfil } from "./BoutonProfil";
import { LogoMarque } from "@/components/logo-marque";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

// En-tête de « Ma carte » (employé d'équipe) : titre, nom de l'équipe, icône de profil (déconnexion avec confirmation).
export function EnteteMaCarte({ sousTitre, nom, onLogout }: { sousTitre: string; nom: string | null; onLogout: () => void }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <LogoMarque taille={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Ma carte
        </Text>
        <Text style={styles.sous} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sousTitre}
        </Text>
      </View>
      <BoutonProfil nom={nom} role="Employé d'équipe" onDeconnexion={onLogout} />
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  entete: { backgroundColor: P.header, paddingHorizontal: 20, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  titre: { color: P.onHeader, fontSize: 26, fontWeight: "700" },
  sous: { color: P.bandeau, fontSize: 15, fontWeight: "500" },
});
