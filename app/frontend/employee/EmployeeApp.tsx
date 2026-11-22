import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { Session } from "../auth";
import { TabBar, TabDef } from "../components/BottomNav";
import { useDemo } from "../context/DemoContext";
import { TEAM_IDS } from "../data/mockData";
import { describeSewer } from "../supervisor/planning";
import EvaluateScreen from "./EvaluateScreen";
import ReportScreen from "./ReportScreen";
import RouteStopScreen from "./RouteStopScreen";
import { E, Header } from "./shared";

type Tab = "tournee" | "rapport";

const TABS: TabDef<Tab>[] = [
  {
    id: "tournee",
    label: "Ma tournée",
    icon: (sel) => <MaterialCommunityIcons name={sel ? "truck" : "truck-outline"} size={30} color={E.green} />,
  },
  {
    id: "rapport",
    label: "Rapport",
    icon: (sel) => <Ionicons name={sel ? "document-text" : "document-text-outline"} size={28} color={E.green} />,
  },
];

function confirmLogout(onLogout: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm("Se déconnecter ?")) onLogout();
    return;
  }
  Alert.alert("Se déconnecter ?", undefined, [
    { text: "Annuler", style: "cancel" },
    { text: "Se déconnecter", style: "destructive", onPress: onLogout },
  ]);
}

// Espace employé : le responsable d'équipe suit sa tournée arrêt par arrêt.
export default function EmployeeApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { tours, alerts, mark, submitTour } = useDemo();
  const [tab, setTab] = useState<Tab>("tournee");
  const [evaluating, setEvaluating] = useState(false);
  const logout = () => confirmLogout(onLogout);

  const team = session.team;
  if (!team) {
    return (
      <View style={styles.root}>
        <Header title="Ma tournée" right={{ icon: "log-out-outline", label: "Se déconnecter", onPress: logout }} />
        <View style={styles.noTeam}>
          <Text style={styles.noTeamTitle}>Aucune équipe associée à ce courriel</Text>
          <Text style={styles.noTeamText}>
            Connectez-vous avec le compte de votre équipe :{" "}
            {TEAM_IDS.map((id) => `equipe.${id.slice(-1).toLowerCase()}@montreal.ca`).join(", ")}.
          </Text>
        </View>
      </View>
    );
  }

  // Tournée en cours de l'équipe et prochain arrêt à évaluer.
  const tour = [...tours].reverse().find((t) => t.teamId === team && t.state !== "Validée");
  const nextIndex = tour && tour.state !== "À valider" ? tour.items.findIndex((i) => i.status === "À faire") : -1;
  const next = tour && nextIndex >= 0 ? tour.items[nextIndex] : null;
  const info = next ? describeSewer(next.sewerId, alerts) : null;

  const emptyMessage = !tour
    ? `Aucune tournée assignée à ${team} pour le moment.`
    : "Tournée terminée : le rapport a été transmis au superviseur.";

  function send(fixed: boolean, comment: string) {
    if (!tour || !next) return;
    mark(tour.id, next.sewerId, fixed ? "Fait" : "À suivre", comment);
    const remaining = tour.items.filter((i) => i.status === "À faire" && i.sewerId !== next.sewerId).length;
    // Dernier arrêt évalué : la tournée part au superviseur pour validation.
    if (remaining === 0) submitTour(tour.id);
    setEvaluating(false);
  }

  if (evaluating && info) {
    return <EvaluateScreen info={info} onBack={() => setEvaluating(false)} onSend={send} />;
  }

  return (
    <View style={styles.root}>
      {tab === "tournee" ? (
        <RouteStopScreen
          info={info}
          position={nextIndex + 1}
          total={tour?.items.length ?? 0}
          emptyMessage={emptyMessage}
          onEvaluate={() => setEvaluating(true)}
          onLogout={logout}
        />
      ) : (
        <ReportScreen team={team} />
      )}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  noTeam: {
    padding: 24,
    gap: 10,
  },
  noTeamTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: E.text,
  },
  noTeamText: {
    fontSize: 15,
    color: E.muted,
    lineHeight: 21,
  },
});
