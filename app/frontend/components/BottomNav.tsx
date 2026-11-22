import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

export type CitizenTab = "carte" | "alertes";

// Hauteur de la barre sans la zone de sécurité du bas.
export const BOTTOM_NAV_HEIGHT = 92;

const C = {
  green: Palette.header,
  cream: Palette.onHeader,
  sage: Palette.backgroundSelected,
};

type IconName = keyof typeof Ionicons.glyphMap;

// Icône pleine pour l'onglet actif, contour sinon.
const TABS: { id: CitizenTab; label: string; icon: IconName; iconActive: IconName }[] = [
  { id: "carte", label: "Carte", icon: "location-outline", iconActive: "location-sharp" },
  { id: "alertes", label: "Mes alertes", icon: "list", iconActive: "list" },
];

type Props = {
  active: CitizenTab;
  onChange: (tab: CitizenTab) => void;
};

export function BottomNav({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Ionicons name={selected ? tab.iconActive : tab.icon} size={30} color={C.green} />
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.cream,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 26,
  },
  tabActive: {
    backgroundColor: C.sage,
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: C.green,
  },
  labelActive: {
    fontWeight: "700",
  },
});
