import React, { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconeAnimee } from '@/components/mouvement/icone-animee';
import { PastilleGlissante, type CiblePastille } from '@/components/mouvement/pastille-glissante';
import { RebondEchelle } from '@/components/mouvement/rebond-echelle';
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
  // La pastille de l'onglet actif glisse d'un onglet à l'autre.
  const [mesures, setMesures] = useState<Record<string, CiblePastille>>({});
  const mesurer = (id: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setMesures((m) => (m[id] && m[id].x === x && m[id].y === y && m[id].largeur === width && m[id].hauteur === height ? m : { ...m, [id]: { x, y, largeur: width, hauteur: height } }));
  };

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <PastilleGlissante cible={mesures[active] ?? null} style={styles.pastille} />
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onLayout={mesurer(tab.id)}
            style={styles.tab}
          >
            <RebondEchelle actif={selected}>
              <IconeAnimee nom={selected ? tab.iconActive : tab.icon} taille={30} couleur={P.primary} />
            </RebondEchelle>
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
  pastille: {
    backgroundColor: P.backgroundSelected,
    borderRadius: 30,
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
