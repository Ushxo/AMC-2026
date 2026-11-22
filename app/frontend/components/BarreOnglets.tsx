import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

export type Onglet<Id extends string> = {
  id: Id;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

// Barre d'onglets du bas (même allure que celle du citoyen), placée sous le contenu : rien ne passe dessous.
export function BarreOnglets<Id extends string>({ onglets, actif, onChange }: { onglets: Onglet<Id>[]; actif: Id; onChange: (id: Id) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {onglets.map((o) => {
        const selected = o.id === actif;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Ionicons name={selected ? o.iconActive : o.icon} size={24} color={Palette.header} />
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.3} adjustsFontSizeToFit minimumFontScale={0.8}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    backgroundColor: Palette.onHeader,
    paddingTop: 8,
    paddingHorizontal: 6,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, borderRadius: 18, minHeight: 56, gap: 2, minWidth: 44 },
  tabActive: { backgroundColor: Palette.backgroundSelected },
  label: { color: Palette.header, fontSize: 11, fontWeight: "600" },
  labelActive: { fontWeight: "800" },
});
