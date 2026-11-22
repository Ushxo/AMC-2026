import React from "react";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

// En-tête vert des pages des maquettes : flèche de retour (facultative), titre, sous-titre.
export function EnteteVert({ titre, sousTitre, onBack, libelleRetour = "Retour" }: { titre: string; sousTitre?: string; onBack?: () => void; libelleRetour?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 14 }]}>
      <StatusBar barStyle="light-content" />
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={libelleRetour} hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text style={styles.sous} maxFontSizeMultiplier={1.3}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { backgroundColor: Palette.header, paddingHorizontal: 18, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  titre: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  sous: { color: "#DCE5CC", fontSize: 15, fontWeight: "500" },
});
