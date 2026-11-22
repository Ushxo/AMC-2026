import React from "react";
import { Image, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProblemIllustration } from "../components/ProblemIllustration";
import { formatDate, KIND_TITLES } from "../format";
import { describeSewer } from "../supervisor/planning";

export const E = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  card: "#FCF8F0",
  orange: "#E0661C",
  sageSoft: "#E3EED8",
  sageBorder: "#3E6B36",
  border: "#D9D8CC",
  text: "#2B3328",
  muted: "#6E7468",
  white: "#FFFFFF",
  red: "#C8221B",
};

type Info = ReturnType<typeof describeSewer>;

// En-tête vert : titre centré, bouton à gauche et à droite facultatifs.
export function Header({
  title,
  left,
  right,
}: {
  title: string;
  left?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
  right?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.side}>
        {left && (
          <Pressable onPress={left.onPress} hitSlop={10} accessibilityLabel={left.label}>
            <Ionicons name={left.icon} size={28} color={E.cream} />
          </Pressable>
        )}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {right && (
          <Pressable onPress={right.onPress} hitSlop={10} accessibilityLabel={right.label}>
            <Ionicons name={right.icon} size={26} color={E.cream} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Photo du citoyen si elle existe, sinon l'illustration du problème.
export function StopPhoto({ info, size = 96 }: { info: Info; size?: number }) {
  if (info.photoUri) {
    return <Image source={{ uri: info.photoUri }} style={[styles.photo, { width: size, height: size }]} />;
  }
  const scale = (size - 8) / 120;
  return (
    <View style={[styles.photo, styles.photoFallback, { width: size, height: size }]}>
      <View style={{ transform: [{ scale }] }}>
        <ProblemIllustration kind={info.kind} />
      </View>
    </View>
  );
}

export function StopSummary({ info, showDate = true }: { info: Info; showDate?: boolean }) {
  return (
    <View style={styles.summary}>
      <StopPhoto info={info} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{KIND_TITLES[info.kind]}</Text>
        <View style={styles.row}>
          <Ionicons name="location" size={15} color={E.red} />
          <Text style={styles.detail}>
            {info.sewer?.label ?? "Égout"} · {info.sewer?.territory ?? "Montréal"}
          </Text>
        </View>
        {showDate && info.lastDate && (
          <Text style={styles.date}>• Signalé le {formatDate(info.lastDate)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: E.green,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 2,
  },
  side: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: E.cream,
    fontSize: 21,
    fontWeight: "800",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  photo: {
    borderRadius: 14,
  },
  photoFallback: {
    backgroundColor: "#ECEBE1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#151A13",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detail: {
    flexShrink: 1,
    color: E.text,
    fontSize: 14,
  },
  date: {
    color: E.muted,
    fontSize: 13,
    marginTop: 5,
  },
});
