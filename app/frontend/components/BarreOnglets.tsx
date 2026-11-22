import React from "react";
import { Pressable, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

export type Onglet<Id extends string> = {
  id: Id;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

// Barre d'onglets du bas (même allure que celle du citoyen), placée sous le contenu : rien ne passe dessous.
export function BarreOnglets<Id extends string>({ onglets, actif, onChange }: { onglets: Onglet<Id>[]; actif: Id; onChange: (id: Id) => void }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
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
            <Ionicons name={selected ? o.iconActive : o.icon} size={24} color={P.primary} />
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.3} adjustsFontSizeToFit minimumFontScale={0.8}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  nav: {
    flexDirection: "row",
    backgroundColor: P.onHeader,
    paddingTop: 8,
    paddingHorizontal: 6,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, borderRadius: 18, minHeight: 56, gap: 2, minWidth: 44 },
  tabActive: { backgroundColor: P.backgroundSelected },
  label: { color: P.primary, fontSize: 11, fontWeight: "600" },
  labelActive: { fontWeight: "800" },
});
