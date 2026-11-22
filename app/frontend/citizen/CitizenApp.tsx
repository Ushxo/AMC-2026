import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { BOTTOM_NAV_HEIGHT, BottomNav, CitizenTab } from "../components/BottomNav";
import EcranCarteCitoyen from "@/components/citoyen/ecran-carte";
import { Palette } from "@/constants/theme";
import MyAlerts from "./MyAlerts";

// Application citoyen plein écran : Carte / Mes alertes avec la barre du bas.
export default function CitizenApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<CitizenTab>("carte");

  // L'icône de profil propose la déconnexion.
  function openProfile() {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) onLogout();
      return;
    }
    Alert.alert("Mon compte", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: onLogout },
    ]);
  }

  return (
    <View style={styles.root}>
      {tab === "carte" ? <EcranCarteCitoyen coquille={{ espaceBas: BOTTOM_NAV_HEIGHT, onOpenProfile: openProfile }} /> : <MyAlerts />}
      <BottomNav active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
});
