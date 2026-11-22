import React, { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Session } from "./auth";
import EmployeeMap from "./employee/EmployeeMap";
import AlertsManagement from "./supervisor/AlertsManagement";
import ReportsValidation from "./supervisor/ReportsValidation";
import RouteOptimization from "./supervisor/RouteOptimization";
import SupervisorDashboard from "./supervisor/SupervisorDashboard";
import TeamManagement from "./supervisor/TeamManagement";

const C = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  sage: "#DCE5CC",
  muted: "#6E7468",
};

const SUPERVISOR_TABS = ["Tableau de bord", "Alertes", "Optimisation", "Équipes", "Rapports"] as const;
type SupervisorTab = (typeof SUPERVISOR_TABS)[number];

function SupervisorScreen({ tab }: { tab: SupervisorTab }) {
  switch (tab) {
    case "Tableau de bord":
      return <SupervisorDashboard />;
    case "Alertes":
      return <AlertsManagement />;
    case "Optimisation":
      return <RouteOptimization />;
    case "Équipes":
      return <TeamManagement />;
    case "Rapports":
      return <ReportsValidation />;
  }
}

// Espace municipal : employé (une page) ou superviseur (onglets).
export default function StaffApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SupervisorTab>("Tableau de bord");
  const isSupervisor = session.role === "superviseur";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Piorix</Text>
          <Text style={styles.who} numberOfLines={1}>
            {isSupervisor ? "Superviseur" : session.team ?? "Responsable d’équipe"} · {session.email}
          </Text>
        </View>
        <Pressable style={styles.logout} onPress={onLogout} accessibilityLabel="Se déconnecter">
          <Ionicons name="log-out-outline" size={22} color={C.cream} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>

      {isSupervisor && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {SUPERVISOR_TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {isSupervisor ? <SupervisorScreen tab={tab} /> : <EmployeeMap team={session.team} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    backgroundColor: C.green,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brand: {
    color: C.cream,
    fontSize: 26,
    fontWeight: "800",
  },
  who: {
    color: "#DCDACE",
    fontSize: 13,
    marginTop: 2,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  logoutText: {
    color: C.cream,
    fontWeight: "700",
    fontSize: 13,
  },
  tabs: {
    flexGrow: 0,
  },
  tabsContent: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  tabActive: {
    backgroundColor: C.sage,
  },
  tabText: {
    color: C.muted,
    fontWeight: "700",
  },
  tabTextActive: {
    color: C.green,
  },
});
