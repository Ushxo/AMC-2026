import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDemo } from "../context/DemoContext";
import { SEWERS } from "../data/mockData";
import { formatDate, KIND_TITLES } from "../format";
import { AlertKind } from "../types/models";
import { buildInterventions, Importance, IMPORTANCE_ORDER, Intervention } from "./planning";
import { FilterChip, ImportanceTile, S, SmallIllustration } from "./ui";

type Props = {
  reportsToValidate: number;
  onOpenReports: () => void;
  onOpenProfile: () => void;
  onComputeRoute: (items: Intervention[]) => void;
  notice?: string | null;
  onDismissNotice: () => void;
};

const SECTORS = Array.from(new Set(SEWERS.map((s) => s.territory)));
const KINDS = Object.keys(KIND_TITLES) as AlertKind[];

// Tableau de bord superviseur : interventions à planifier, triées par importance.
export default function PlanningScreen({
  reportsToValidate,
  onOpenReports,
  onOpenProfile,
  onComputeRoute,
  notice,
  onDismissNotice,
}: Props) {
  const insets = useSafeAreaInsets();
  const { alerts } = useDemo();
  const [sector, setSector] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [importance, setImportance] = useState<string | null>(null);

  const all = useMemo(() => buildInterventions(alerts), [alerts]);
  const list = all.filter(
    (i) =>
      (!sector || i.sewer.territory === sector) &&
      (!kind || KIND_TITLES[i.kind] === kind) &&
      (!importance || i.importance === importance),
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="account-hard-hat-outline" size={46} color={S.cream} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Superviseur</Text>
          <Text style={styles.headerSub}>Tableau de bord des interventions</Text>
        </View>
        <Pressable
          onPress={onOpenReports}
          hitSlop={8}
          accessibilityLabel={`Rapports à valider : ${reportsToValidate}`}
        >
          <Ionicons name="notifications-outline" size={32} color={S.cream} />
          {reportsToValidate > 0 && <View style={styles.bellDot} />}
        </Pressable>
        <Pressable onPress={onOpenProfile} hitSlop={8} accessibilityLabel="Mon compte">
          <Ionicons name="person-circle-outline" size={44} color={S.cream} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Interventions à planifier</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              <Text style={{ fontWeight: "800", color: S.green }}>{all.length}</Text> à traiter
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Priorisées par degré d’importance pour l’optimisation du trajet.</Text>

        {notice && (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={24} color={S.green} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Pressable onPress={onDismissNotice} hitSlop={8}>
              <Ionicons name="close" size={20} color={S.green} />
            </Pressable>
          </View>
        )}

        <View style={styles.filtersLabel}>
          <Ionicons name="funnel-outline" size={22} color={S.text} />
          <Text style={styles.filtersText}>Filtres</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip icon="location-outline" label="Secteur" value={sector} options={SECTORS} onChange={setSector} />
          <FilterChip icon="warning-outline" label="Type de problème" value={kind} options={KINDS.map((k) => KIND_TITLES[k])} onChange={setKind} />
          <FilterChip icon="list" label="Importance" value={importance} options={IMPORTANCE_ORDER as string[]} onChange={setImportance} />
        </ScrollView>

        <View style={styles.list}>
          {list.map((item) => (
            <View key={item.sewer.id} style={styles.card}>
              <ImportanceTile importance={item.importance as Importance} />
              <SmallIllustration kind={item.kind} scale={0.62} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{KIND_TITLES[item.kind]}</Text>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={15} color={S.text} />
                  <Text style={styles.detail} numberOfLines={1}>
                    {item.sewer.label} · {item.sewer.territory}
                  </Text>
                </View>
                <Text style={styles.detailMuted}>
                  Signalée le {formatDate(item.lastDate)}
                  {item.alerts.length > 1 ? ` · ${item.alerts.length} signalements` : ""}
                </Text>
              </View>
            </View>
          ))}

          {!list.length && (
            <View style={[styles.card, { justifyContent: "center" }]}>
              <Text style={styles.detail}>
                {all.length ? "Aucune intervention ne correspond à ces filtres." : "Aucune intervention à planifier pour le moment."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.cta, !list.length && { opacity: 0.5 }]}
          disabled={!list.length}
          onPress={() => onComputeRoute(list)}
        >
          <MaterialCommunityIcons name="map-marker-path" size={40} color={S.white} />
          <View style={styles.ctaDivider} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Calculer le trajet optimal</Text>
            <Text style={styles.ctaSub}>
              {list.length} intervention{list.length > 1 ? "s" : ""} · puis assigner à une équipe
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={28} color={S.white} />
        </Pressable>
      </View>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  headerTitle: {
    color: S.cream,
    fontSize: 26,
    fontWeight: "800",
  },
  headerSub: {
    color: "#E3E1D5",
    fontSize: 14,
    marginTop: 2,
  },
  bellDot: {
    position: "absolute",
    top: 0,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: S.orange,
    borderWidth: 1.5,
    borderColor: S.green,
  },
  sheet: {
    flex: 1,
    backgroundColor: S.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 23,
    fontWeight: "800",
    color: "#151A13",
  },
  countPill: {
    backgroundColor: "#F6E9C8",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  countText: {
    color: S.text,
    fontSize: 14,
  },
  subtitle: {
    color: S.muted,
    fontSize: 14,
    marginTop: 6,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: S.sageSoft,
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
  },
  noticeText: {
    flex: 1,
    color: S.green,
    fontWeight: "700",
  },
  filtersLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  filtersText: {
    fontSize: 18,
    fontWeight: "800",
    color: S.text,
  },
  filters: {
    gap: 8,
    paddingVertical: 12,
  },
  list: {
    gap: 12,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: S.card,
    borderRadius: 22,
    padding: 10,
    minHeight: 92,
    shadowColor: "#1A261A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#151A13",
    marginBottom: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detail: {
    flexShrink: 1,
    color: S.text,
    fontSize: 13,
  },
  detailMuted: {
    color: S.muted,
    fontSize: 12,
    marginTop: 3,
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
    gap: 12,
    backgroundColor: S.orange,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  ctaDivider: {
    width: 1.5,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  ctaTitle: {
    color: S.white,
    fontSize: 18,
    fontWeight: "800",
  },
  ctaSub: {
    color: "#FFE6D6",
    fontSize: 13,
    marginTop: 2,
  },
});
