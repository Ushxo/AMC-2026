import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { useDemo } from "../context/DemoContext";
import { KIND_TITLES } from "../format";
import { describeSewer } from "../supervisor/planning";
import { Tour, WorkStatus } from "../types/models";
import { E, Header } from "./shared";

const TOUR_STATE: Record<Tour["state"], { label: string; color: string; bg: string }> = {
  Assignée: { label: "À commencer", color: E.orange, bg: "#FCE5D2" },
  "En cours": { label: "En cours", color: E.orange, bg: "#FCE5D2" },
  "À valider": { label: "Transmis au superviseur", color: "#8A6A05", bg: "#FBF0CE" },
  Validée: { label: "Validé", color: E.green, bg: E.sageSoft },
};

const ITEM_ICON: Record<WorkStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  "À faire": { icon: "ellipse-outline", color: E.muted, label: "À faire" },
  Fait: { icon: "checkmark-circle", color: E.green, label: "Réparé" },
  "À suivre": { icon: "alert-circle", color: E.orange, label: "Pas réglé" },
};

// Rapport : état de chaque arrêt des tournées de l'équipe.
export default function ReportScreen({ team }: { team: string }) {
  const insets = useSafeAreaInsets();
  const { tours, alerts } = useDemo();
  const own = [...tours].reverse().filter((t) => t.teamId === team);

  return (
    <View style={styles.root}>
      <Header title="Rapport" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 20 }]}>
        {!own.length && <Text style={styles.empty}>Aucune tournée pour {team} pour le moment.</Text>}

        {own.map((tour, n) => {
          const st = TOUR_STATE[tour.state];
          const done = tour.items.filter((i) => i.status !== "À faire").length;
          return (
            <View key={tour.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{n === 0 ? "Tournée actuelle" : "Tournée précédente"}</Text>
                <Text style={[styles.state, { color: st.color, backgroundColor: st.bg }]}>{st.label}</Text>
              </View>
              <Text style={styles.progress}>
                {done}/{tour.items.length} arrêts évalués
              </Text>

              {tour.items.map((item, i) => {
                const info = describeSewer(item.sewerId, alerts);
                const ic = ITEM_ICON[item.status];
                return (
                  <View key={item.sewerId} style={styles.item}>
                    <Ionicons name={ic.icon} size={24} color={ic.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>
                        {i + 1}. {KIND_TITLES[info.kind]}
                      </Text>
                      <Text style={styles.itemSub}>
                        {info.sewer?.label} · {ic.label}
                      </Text>
                      {item.reason ? <Text style={styles.reason}>« {item.reason} »</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  empty: {
    color: E.muted,
    fontSize: 16,
    textAlign: "center",
    marginTop: 30,
  },
  card: {
    backgroundColor: E.card,
    borderRadius: 22,
    padding: 16,
    shadowColor: "#1A261A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#151A13",
  },
  state: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
  },
  progress: {
    color: E.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  item: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#ECE9DE",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: E.text,
  },
  itemSub: {
    fontSize: 13,
    color: E.muted,
    marginTop: 2,
  },
  reason: {
    fontSize: 13,
    color: E.text,
    fontStyle: "italic",
    marginTop: 4,
  },
});
