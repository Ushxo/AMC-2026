import React from "react";
import { StyleSheet, View } from "react-native";

// Logo Piorix : plan de rues avec un repère orange contenant une grille d'égout.
const STREETS = [
  { top: 18, left: -20, width: 160, rotate: "28deg" },
  { top: 62, left: -30, width: 180, rotate: "-18deg" },
  { top: 96, left: -20, width: 170, rotate: "12deg" },
  { top: 40, left: 40, width: 120, rotate: "70deg" },
  { top: 60, left: -10, width: 120, rotate: "-62deg" },
  { top: 70, left: 60, width: 110, rotate: "-48deg" },
];

export function AppLogo() {
  return (
    <View style={{ width: 120, height: 120 }}>
      <View style={styles.tile}>
        {STREETS.map((s, i) => (
          <View
            key={i}
            style={[styles.street, { top: s.top, left: s.left, width: s.width, transform: [{ rotate: s.rotate }] }]}
          />
        ))}
        <View style={styles.pinWrap}>
          <View style={styles.pin}>
            <View style={styles.pinFace}>
              <View style={styles.grate}>
                {[14, 20, 20, 14].map((w, i) => (
                  <View key={i} style={[styles.bar, { width: w }]} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    width: 120,
    height: 120,
    left: 0,
    top: 0,
    borderRadius: 30,
    backgroundColor: "#243F21",
    borderWidth: 2,
    borderColor: "#5E7A57",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  street: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9DB592",
    opacity: 0.85,
  },
  pinWrap: {
    marginTop: -10,
  },
  // Goutte : carré tourné de 45° avec un coin pointu vers le bas.
  pin: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderBottomRightRadius: 4,
    backgroundColor: "#EE6A1F",
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  pinFace: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8F5ED",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-45deg" }],
  },
  grate: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#1E2A1C",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1E2A1C",
  },
});
