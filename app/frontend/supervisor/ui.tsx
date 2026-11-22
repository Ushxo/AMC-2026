import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProblemIllustration } from "../components/ProblemIllustration";
import { AlertKind } from "../types/models";
import { Importance } from "./planning";

export const S = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  card: "#FCF8F0",
  orange: "#EE5F12",
  border: "#D3D2C6",
  text: "#2B3328",
  muted: "#6E7468",
  white: "#FFFFFF",
  sageSoft: "#DCEBD3",
};

// Couleurs et icône de chaque degré d'importance.
// Accents : rouge (le plus grave), orange, vert — posés sur la palette crème / vert forêt.
export const IMPORTANCE_STYLE: Record<
  Importance,
  {
    bg: string;
    pill: string;
    text: string;
    soft: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    level: number; // 3 = le plus grave
    caption: string;
  }
> = {
  Urgent: {
    bg: "#F9DCD7",
    pill: "#C4302B",
    text: "#A8251F",
    soft: "#FCEBE8",
    icon: "alarm-light",
    level: 3,
    caption: "Priorité 1",
  },
  Élevée: {
    bg: "#FBE2CC",
    pill: "#E2671A",
    text: "#B94F0E",
    soft: "#FDF0E3",
    icon: "alert",
    level: 2,
    caption: "Priorité 2",
  },
  Moyenne: {
    bg: "#DDEBD5",
    pill: "#3F7A3A",
    text: "#2D5F29",
    soft: "#EDF5E8",
    icon: "shield-check",
    level: 1,
    caption: "Priorité 3",
  },
};

// Code de priorité discret : une fine barre de couleur sur le bord gauche de la carte.
export function ImportanceTile({ importance }: { importance: Importance }) {
  const st = IMPORTANCE_STYLE[importance];
  return (
    <View
      style={[styles.tile, { backgroundColor: st.pill }]}
      accessibilityLabel={`Importance ${importance}, ${st.caption.toLowerCase()}`}
    />
  );
}

export function ImportanceBadge({ importance }: { importance: Importance }) {
  const st = IMPORTANCE_STYLE[importance];
  return (
    <View style={[styles.badge, { backgroundColor: st.soft }]}>
      <Text style={[styles.badgeText, { color: st.text }]}>{importance}</Text>
    </View>
  );
}

// Illustration du problème réduite pour les listes.
export function SmallIllustration({ kind, scale = 0.7 }: { kind: AlertKind; scale?: number }) {
  return (
    <View style={{ width: 120 * scale, height: 92 * scale, alignItems: "center", justifyContent: "center" }}>
      <View style={{ transform: [{ scale }] }}>
        <ProblemIllustration kind={kind} />
      </View>
    </View>
  );
}

type FilterProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
};

// Menu déroulant : une pastille qui ouvre la liste des choix en bas de l'écran.
export function FilterChip({ icon, label, value, options, onChange }: FilterProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const active = value !== null;

  function pick(v: string | null) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.chip, active && styles.chipActive]}
        accessibilityLabel={`${label} : ${value ?? "tous"}`}
      >
        <Ionicons name={icon} size={18} color={S.text} />
        <Text style={styles.chipText} numberOfLines={1}>
          {value ?? label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={S.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>{label}</Text>
          {[null, ...options].map((opt) => {
            const selected = opt === value;
            return (
              <Pressable key={opt ?? "all"} style={styles.option} onPress={() => pick(opt)}>
                <Text style={[styles.optionText, selected && { fontWeight: "800" }]}>{opt ?? "Tous"}</Text>
                {selected && <Ionicons name="checkmark" size={22} color={S.green} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: 3,
    marginVertical: 4,
  },
  tilePillText: {
    color: S.white,
    fontSize: 12,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: S.border,
    backgroundColor: S.cream,
  },
  chipActive: {
    borderColor: S.green,
    backgroundColor: S.sageSoft,
  },
  chipText: {
    color: S.text,
    fontSize: 14,
    maxWidth: 130,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: S.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: S.green,
    marginBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E4D9",
  },
  optionText: {
    fontSize: 16,
    color: S.text,
  },
});
