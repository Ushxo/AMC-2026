import React from "react";
import { Image, StyleSheet, View } from "react-native";

const SIZE = 120;

// Logo Priorix : plan de rues avec un repère orange contenant une grille d'égout.
// L'image a des coins blancs : les coins arrondis du cadre les masquent.
export function AppLogo() {
  return (
    <View style={styles.cadre} accessibilityRole="image" accessibilityLabel="Logo Priorix">
      <Image source={require("../../assets/images/logo-priorix.png")} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE * 0.23,
    overflow: "hidden",
    backgroundColor: "#2E4229",
  },
  image: {
    // Légèrement agrandie pour que les coins blancs restent hors du cadre.
    width: SIZE + 4,
    height: SIZE + 4,
    margin: -2,
  },
});
