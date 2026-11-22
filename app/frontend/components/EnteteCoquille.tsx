import React from "react";
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

// En-tête commun des coquilles Superviseur et Employé : nom de l'app, qui est connecté, déconnexion.
export function EnteteCoquille({ sousTitre, onLogout }: { sousTitre: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <Text style={styles.brand} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Priorix
        </Text>
        <Text style={styles.who} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sousTitre}
        </Text>
      </View>
      <Pressable style={styles.logout} onPress={onLogout} accessibilityRole="button" accessibilityLabel="Se déconnecter">
        <Ionicons name="log-out-outline" size={22} color={Palette.onHeader} />
        <Text style={styles.logoutText} maxFontSizeMultiplier={1.3}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Palette.header,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brand: { color: Palette.onHeader, fontSize: 26, fontWeight: "800" },
  who: { color: "#DCDACE", fontSize: 13, marginTop: 2 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    minHeight: 44,
    minWidth: 44,
    flexShrink: 0,
  },
  logoutText: { color: Palette.onHeader, fontWeight: "700", fontSize: 13 },
});
