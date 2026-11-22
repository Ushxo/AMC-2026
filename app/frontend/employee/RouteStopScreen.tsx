import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { describeSewer } from "../supervisor/planning";
import { E, Header, StopSummary } from "./shared";

type Props = {
  info: ReturnType<typeof describeSewer> | null;
  position: number; // numéro de l'arrêt (1, 2, …)
  total: number;
  emptyMessage: string;
  onEvaluate: () => void;
  onLogout: () => void;
};

// Intervention sur la route : carte du trajet + prochain arrêt.
export default function RouteStopScreen({ info, position, total, emptyMessage, onEvaluate, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.root}>
      <Header
        title="Intervention sur la route"
        right={{ icon: "log-out-outline", label: "Se déconnecter", onPress: onLogout }}
      />

      {/* Emplacement de la carte du trajet : fond noir en attendant la carte réelle. */}
      <View style={styles.map}>
        {info && (
          <View style={styles.stopBadge}>
            <Text style={styles.stopBadgeText}>
              Prochain arrêt ({position}/{total})
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.panel, { paddingBottom: bottom + 18 }]}>
        {info ? (
          <>
            <StopSummary info={info} />
            <Pressable style={styles.cta} onPress={onEvaluate}>
              <Text style={styles.ctaText}>Évaluer l’intervention</Text>
              <Ionicons name="arrow-forward" size={24} color={E.white} />
            </Pressable>
          </>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={E.green} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  map: {
    flex: 1,
    marginTop: -24,
    backgroundColor: "#000000",
  },
  stopBadge: {
    position: "absolute",
    top: 40,
    right: 16,
    backgroundColor: E.green,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  stopBadgeText: {
    color: E.cream,
    fontWeight: "700",
    fontSize: 14,
  },
  panel: {
    backgroundColor: E.cream,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -28,
    paddingHorizontal: 18,
    paddingTop: 22,
    gap: 20,
  },
  cta: {
    height: 58,
    borderRadius: 29,
    backgroundColor: E.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  ctaText: {
    color: E.white,
    fontSize: 19,
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  emptyText: {
    color: E.text,
    fontSize: 16,
    textAlign: "center",
  },
});
