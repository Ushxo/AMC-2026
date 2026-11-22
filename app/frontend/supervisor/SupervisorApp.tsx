import React, { useState } from "react";
import { Alert, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDemo } from "../context/DemoContext";
import PlanningScreen from "./PlanningScreen";
import { Intervention } from "./planning";
import ReportsValidation from "./ReportsValidation";
import RouteScreen from "./RouteScreen";
import TeamManagement from "./TeamManagement";
import { S } from "./ui";

type Screen = { name: "home" } | { name: "route"; items: Intervention[] } | { name: "reports" } | { name: "teams" };

// En-tête simple avec retour, pour les écrans secondaires (rapports, équipes).
function SubScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={30} color={S.cream} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>{children}</View>
    </View>
  );
}

export default function SupervisorApp({ onLogout }: { onLogout: () => void }) {
  const { tours } = useDemo();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [notice, setNotice] = useState<string | null>(null);
  const home = () => setScreen({ name: "home" });

  const reportsToValidate = tours.filter((t) => t.state === "À valider").length;

  function openProfile() {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) onLogout();
      return;
    }
    Alert.alert("Mon compte", undefined, [
      { text: "Équipes", onPress: () => setScreen({ name: "teams" }) },
      { text: "Rapports à valider", onPress: () => setScreen({ name: "reports" }) },
      { text: "Se déconnecter", style: "destructive", onPress: onLogout },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  switch (screen.name) {
    case "route":
      return (
        <RouteScreen
          items={screen.items}
          onBack={home}
          onAssigned={(team, count) => {
            setNotice(`Trajet de ${count} intervention${count > 1 ? "s" : ""} assigné à ${team}.`);
            home();
          }}
        />
      );
    case "reports":
      return (
        <SubScreen title="Rapports à valider" onBack={home}>
          <ReportsValidation />
        </SubScreen>
      );
    case "teams":
      return (
        <SubScreen title="Équipes" onBack={home}>
          <TeamManagement />
        </SubScreen>
      );
    default:
      return (
        <PlanningScreen
          reportsToValidate={reportsToValidate}
          onOpenReports={() => setScreen({ name: "reports" })}
          onOpenProfile={openProfile}
          onComputeRoute={(items) => setScreen({ name: "route", items })}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
        />
      );
  }
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
    paddingBottom: 22,
  },
  headerTitle: {
    color: S.cream,
    fontSize: 26,
    fontWeight: "800",
  },
  body: {
    flex: 1,
    backgroundColor: S.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
});
