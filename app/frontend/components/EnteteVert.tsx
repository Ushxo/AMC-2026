import React, { type ReactNode } from "react";
import { StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from "@/components/texte";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMarque } from "@/components/logo-marque";
import { useMarque, useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

// En-tête vert des pages des maquettes : flèche de retour (facultative), titre, sous-titre.
export function EnteteVert({ titre, sousTitre, onBack, libelleRetour = "Retour", droite }: { titre: string; sousTitre?: string; onBack?: () => void; libelleRetour?: string; droite?: ReactNode }) {
  const P = useTheme();
  const { organisation } = useMarque();
  const styles = useStyles(creerStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 14 }]}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={libelleRetour} hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color={P.onHeader} />
        </Pressable>
      ) : (
        <LogoMarque taille={44} />
      )}
      <View style={{ flex: 1 }}>
        {onBack ? null : (
          <Text style={styles.organisation} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {organisation.nom_app}
          </Text>
        )}
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text style={styles.sous} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      {droite ?? (onBack ? <LogoMarque taille={36} /> : null)}
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  entete: { backgroundColor: P.header, paddingHorizontal: 20, paddingBottom: 24, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  organisation: { color: P.onHeaderSoft, fontSize: 13, fontWeight: "600" },
  titre: { color: P.onHeader, fontSize: 26, fontWeight: "700" },
  // Deux lignes toujours réservées : changer de page (sous-titre court ou long) ne change jamais la hauteur de l'en-tête.
  sous: { color: P.onHeaderSoft, fontSize: 15, lineHeight: 20, minHeight: 40, fontWeight: "500" },
});
