import React, { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconeBascule } from '@/components/mouvement/icone-bascule';
import { useOngletUnique } from '@/components/mouvement/onglets-gardes';
import { PastilleGlissante, type CiblePastille } from '@/components/mouvement/pastille-glissante';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

export type Onglet<Id extends string> = {
  id: Id;
  /** Libellé court sous l'icône (jamais coupé dans un mot). */
  label: string;
  /** Nom complet, lu par le lecteur d'écran. */
  nom?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

// Barre d'onglets du bas (même allure que celle du citoyen), placée sous le contenu : rien ne passe dessous.
export function BarreOnglets<Id extends string>({ onglets, actif: actifParent, onChange }: { onglets: Onglet<Id>[]; actif: Id; onChange: (id: Id) => void }) {
  // La pastille et l'icône suivent le toucher tout de suite ; le contenu change juste après, en transition.
  const { actifLocal: actif, changer } = useOngletUnique(actifParent, onChange);
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const insets = useSafeAreaInsets();
  // Position de chaque onglet : la pastille de l'onglet actif glisse de l'un à l'autre.
  const [mesures, setMesures] = useState<Record<string, CiblePastille>>({});
  const mesurer = (id: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setMesures((m) => (m[id] && m[id].x === x && m[id].y === y && m[id].largeur === width && m[id].hauteur === height ? m : { ...m, [id]: { x, y, largeur: width, hauteur: height } }));
  };
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      <PastilleGlissante testID="pastille-onglet" cible={mesures[actif] ?? null} style={styles.pastille} />
      {onglets.map((o) => {
        const selected = o.id === actif;
        return (
          <Pressable
            key={o.id}
            onPress={() => changer(o.id)}
            accessibilityRole="tab"
            accessibilityLabel={o.nom ?? o.label}
            accessibilityState={{ selected }}
            onLayout={mesurer(o.id)}
            style={styles.tab}
          >
            <IconeBascule actif={selected} nomVide={o.icon} nomPlein={o.iconActive} taille={24} couleur={P.primary} />
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.92}>
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
    backgroundColor: P.background,
    paddingTop: 8,
    paddingHorizontal: 4,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 16, minHeight: 56, gap: 2, minWidth: 44, paddingHorizontal: 0 },
  pastille: { backgroundColor: P.backgroundSelected, borderRadius: 16 },
  label: { color: P.primary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  labelActive: { fontWeight: "800" },
});
