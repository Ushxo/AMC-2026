import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import EcranCarteCitoyen from "@/components/citoyen/ecran-carte";
import { Palette } from "@/constants/theme";
import { BOTTOM_NAV_HEIGHT, BottomNav, CitizenTab } from "../components/BottomNav";
import MyAlerts from "./MyAlerts";

// Application citoyen plein écran : Carte / Mes alertes avec la barre du bas. Aucune connexion n'est demandée au citoyen.
// L'icône de profil ouvre la connexion du personnel de la Ville ; un compte citoyen déjà connecté peut s'y déconnecter.
export default function CitizenApp({ compteConnecte, onLogout, onStaffLogin }: { compteConnecte: boolean; onLogout: () => void; onStaffLogin: () => void }) {
  const [tab, setTab] = useState<CitizenTab>("carte");
  // La feuille « Quel problème ? » couvre tout le bas de l'écran : la barre du bas se retire pendant qu'elle est ouverte.
  const [feuille, setFeuille] = useState(false);

  function openProfile() {
    if (!compteConnecte) {
      onStaffLogin();
      return;
    }
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
      {tab === "carte" ? <EcranCarteCitoyen coquille={{ espaceBas: BOTTOM_NAV_HEIGHT, onOpenProfile: openProfile, onFeuille: setFeuille }} /> : <MyAlerts />}
      {feuille && tab === "carte" ? null : <BottomNav active={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
});
