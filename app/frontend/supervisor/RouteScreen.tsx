import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDemo } from "../context/DemoContext";
import { TEAM_IDS } from "../data/mockData";
import { KIND_TITLES } from "../format";
import { estimateMinutes, Intervention, orderRoute } from "./planning";
import { IMPORTANCE_STYLE, ImportanceBadge, S, SmallIllustration } from "./ui";

type Props = {
  items: Intervention[];
  onBack: () => void;
  onAssigned: (team: string, count: number) => void;
};

// Trajet optimal : ordre de visite des interventions, puis assignation à une équipe.
export default function RouteScreen({ items, onBack, onAssigned }: Props) {
  const insets = useSafeAreaInsets();
  const { tours, createTour } = useDemo();
  const [picking, setPicking] = useState(false);

  const route = useMemo(() => orderRoute(items), [items]);
  const minutes = estimateMinutes(route);

  function assign(team: string) {
    createTour(route.map((r) => r.sewer.id), team, true);
    setPicking(false);
    onAssigned(team, route.length);
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={30} color={S.cream} />
        </Pressable>
        <Text style={styles.headerTitle}>Trajet optimal</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <MaterialCommunityIcons name="map-marker-path" size={42} color={S.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Trajet généré</Text>
            <Text style={styles.summarySub}>
              Itinéraire optimisé pour {route.length} intervention{route.length > 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.time}>
            <Ionicons name="time-outline" size={18} color={S.green} />
            <Text style={styles.timeText}>{minutes} min</Text>
          </View>
        </View>

        {/* Emplacement de la carte du trajet : fond noir en attendant la carte réelle. */}
        <View style={styles.map} />

        <Text style={styles.sectionTitle}>Interventions du trajet ({route.length})</Text>

        <View style={styles.listCard}>
          {route.map((item, index) => {
            const color = IMPORTANCE_STYLE[item.importance].pill;
            const last = index === route.length - 1;
            return (
              <View key={item.sewer.id} style={styles.stop}>
                <View style={styles.timeline}>
                  <View style={[styles.step, { backgroundColor: color }]}>
                    <Text style={styles.stepText}>{index + 1}</Text>
                  </View>
                  {!last && <View style={[styles.line, { backgroundColor: color }]} />}
                </View>

                <View style={[styles.stopBody, !last && styles.stopDivider]}>
                  <SmallIllustration kind={item.kind} scale={0.55} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopTitle}>{KIND_TITLES[item.kind]}</Text>
                    <View style={styles.row}>
                      <Ionicons name="location" size={14} color={S.text} />
                      <Text style={styles.detail} numberOfLines={1}>
                        {item.sewer.label} · {item.sewer.territory}
                      </Text>
                    </View>
                  </View>
                  <ImportanceBadge importance={item.importance} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.cta} onPress={() => setPicking(true)}>
          <Ionicons name="people-outline" size={32} color={S.white} />
          <View style={styles.ctaDivider} />
          <Text style={styles.ctaTitle}>Assigner à une équipe</Text>
          <Ionicons name="arrow-forward" size={28} color={S.white} />
        </Pressable>
      </View>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
        <View style={[styles.picker, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.pickerTitle}>Choisir l’équipe</Text>
          <Text style={styles.pickerSub}>
            Le responsable de l’équipe verra ce trajet dans « Ma tournée ».
          </Text>
          {TEAM_IDS.map((team) => {
            const active = tours.filter((t) => t.teamId === team && t.state !== "Validée").length;
            return (
              <Pressable key={team} style={styles.teamRow} onPress={() => assign(team)}>
                <Ionicons name="people" size={24} color={S.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{team}</Text>
                  <Text style={styles.teamSub}>
                    {active ? `${active} tournée${active > 1 ? "s" : ""} en cours` : "Disponible"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={S.text} />
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.green,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  headerTitle: {
    color: S.cream,
    fontSize: 28,
    fontWeight: "800",
  },
  sheet: {
    flex: 1,
    backgroundColor: S.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: S.sageSoft,
    borderRadius: 22,
    padding: 14,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: S.green,
  },
  summarySub: {
    color: S.text,
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: S.cream,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  timeText: {
    color: S.green,
    fontWeight: "800",
    fontSize: 15,
  },
  map: {
    height: 250,
    borderRadius: 22,
    backgroundColor: "#000000",
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#151A13",
    marginTop: 18,
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: S.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#1A261A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  timeline: {
    width: 34,
    alignItems: "center",
    paddingTop: 22,
  },
  step: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stepText: {
    color: S.white,
    fontWeight: "800",
    fontSize: 15,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: -2,
    marginBottom: -24,
  },
  stopBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginLeft: 4,
  },
  stopDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#ECE9DE",
  },
  stopTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#151A13",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  detail: {
    flexShrink: 1,
    color: S.text,
    fontSize: 13,
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "rgba(248,244,234,0.96)",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: S.orange,
    borderRadius: 30,
    paddingHorizontal: 22,
    height: 68,
  },
  ctaDivider: {
    width: 1.5,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  ctaTitle: {
    flex: 1,
    color: S.white,
    fontSize: 21,
    fontWeight: "800",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  picker: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: S.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  pickerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: S.green,
  },
  pickerSub: {
    color: S.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E4D9",
  },
  teamName: {
    fontSize: 17,
    fontWeight: "800",
    color: S.text,
  },
  teamSub: {
    fontSize: 13,
    color: S.muted,
    marginTop: 2,
  },
});
