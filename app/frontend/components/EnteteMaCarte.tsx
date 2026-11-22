import React from "react";
import { Alert, Platform, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

// En-tête de « Ma carte » (employé d'équipe) : titre, nom de l'équipe, icône de profil (déconnexion avec confirmation).
export function EnteteMaCarte({ sousTitre, nom, onLogout }: { sousTitre: string; nom: string | null; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  function profil() {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) onLogout();
      return;
    }
    Alert.alert(nom ? `Connecté : ${nom}` : "Mon compte", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: onLogout },
    ]);
  }
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Ma carte
        </Text>
        <Text style={styles.sous} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sousTitre}
        </Text>
      </View>
      <Pressable onPress={profil} accessibilityRole="button" accessibilityLabel="Mon compte et déconnexion" hitSlop={8} style={styles.profil}>
        <Ionicons name="person-circle-outline" size={46} color={Palette.onHeader} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { backgroundColor: Palette.header, paddingHorizontal: 20, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  titre: { color: Palette.onHeader, fontSize: 26, fontWeight: "700" },
  sous: { color: "#DCE5CC", fontSize: 15, fontWeight: "500" },
  profil: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
