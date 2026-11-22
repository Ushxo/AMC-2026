import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Session } from "./auth";
import EmployeeMap from "./employee/EmployeeMap";

const C = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  sage: "#DCE5CC",
  muted: "#6E7468",
};

// Espace employé : le responsable d'équipe et sa tournée.
export default function StaffApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Piorix</Text>
          <Text style={styles.who} numberOfLines={1}>
            {session.team ?? "Responsable d’équipe"} · {session.email}
          </Text>
        </View>
        <Pressable style={styles.logout} onPress={onLogout} accessibilityLabel="Se déconnecter">
          <Ionicons name="log-out-outline" size={22} color={C.cream} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>


      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        <EmployeeMap team={session.team} />
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
});
