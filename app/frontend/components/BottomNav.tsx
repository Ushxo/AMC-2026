import React from "react";
import { StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { COULEUR_OMBRE } from '@/components/ville/style';

export type CitizenTab = "carte" | "alertes";

// Hauteur de la barre sans la zone de sécurité du bas.
export const BOTTOM_NAV_HEIGHT = 92;


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
  const P = useTheme();
  const styles = useStyles(creerStyles);
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
            <Ionicons name={selected ? tab.iconActive : tab.icon} size={30} color={P.primary} />
            <Text style={[styles.label, selected && styles.labelActive]} maxFontSizeMultiplier={1.3}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    backgroundColor: P.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: COULEUR_OMBRE,
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
    paddingVertical: 12,
    borderRadius: 30,
  },
  tabActive: {
    backgroundColor: P.backgroundSelected,
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: P.primary,
  },
  labelActive: {
    fontWeight: "700",
  },
});
