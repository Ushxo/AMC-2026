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

export type TabDef<T extends string> = {
  id: T;
  label: string;
  /** Icône de l'onglet ; selected = onglet actif (icône pleine), color = couleur de la marque. */
  icon: (selected: boolean, color: string) => React.ReactNode;
};

const ionicon = (outline: IconName, filled: IconName) => (selected: boolean, color: string) => (
  <Ionicons name={selected ? filled : outline} size={30} color={color} />
);

// Icône pleine pour l'onglet actif, contour sinon.
const CITIZEN_TABS: TabDef<CitizenTab>[] = [
  { id: "carte", label: "Carte", icon: ionicon("location-outline", "location-sharp") },
  { id: "alertes", label: "Mes alertes", icon: ionicon("list", "list") },
];

type TabBarProps<T extends string> = {
  tabs: TabDef<T>[];
  active: T;
  onChange: (tab: T) => void;
};

// Barre d'onglets du bas, partagée par l'app citoyen et l'espace employé.
export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabActive]}
          >
            {tab.icon(selected, P.primary)}
            <Text style={[styles.label, selected && styles.labelActive]} maxFontSizeMultiplier={1.3}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BottomNav({ active, onChange }: { active: CitizenTab; onChange: (tab: CitizenTab) => void }) {
  return <TabBar tabs={CITIZEN_TABS} active={active} onChange={onChange} />;
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
    paddingVertical: 10,
    borderRadius: 26,
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
