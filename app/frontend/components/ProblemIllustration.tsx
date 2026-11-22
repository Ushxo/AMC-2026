import React from "react";
import { StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import type { Categorie } from "@/types";
import { AlertKind } from "../types/models";

// Dessin de chaque problème proposé (les dessins sont rangés sous les anciens noms de la maquette).
export const ILLUSTRATION_PAR_CATEGORIE: Partial<Record<Categorie, AlertKind>> = {
  grille_bouchee: "Égout bouché",
  eau_accumulee: "Eau accumulée",
  affaissement: "Feuilles",
  grille_endommagee: "Autre",
};

// Illustrations des 4 problèmes, dessinées avec des vues et des icônes.
const INK = "#2E3A2C";
const METAL = "#A8A898";
const ORANGE = "#EE7A1F";
const BLUE = "#3BA6DC";

function Grate({ broken = false }: { broken?: boolean }) {
  if (broken) {
    return (
      <View style={styles.brokenRow}>
        <View style={[styles.grate, styles.grateLeft]}>
          {[0, 1].map((i) => <View key={i} style={styles.bar} />)}
        </View>
        <View style={styles.crackGap} />
        <View style={[styles.grate, styles.grateRight]}>
          {[0, 1, 2].map((i) => <View key={i} style={styles.bar} />)}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.grate}>
      {[0, 1, 2, 3, 4].map((i) => <View key={i} style={styles.bar} />)}
    </View>
  );
}

// Petits traits qui « éclatent » au-dessus de l'objet.
function Burst({ color, style }: { color: string; style?: object }) {
  return (
    <View style={[styles.burst, style]}>
      {[-28, 0, 28].map((deg) => (
        <View key={deg} style={[styles.burstLine, { backgroundColor: color, transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
    </View>
  );
}

function Crack({ style }: { style: object }) {
  return <View style={[styles.crack, style]} />;
}

export function ProblemIllustration({ kind }: { kind: AlertKind }) {
  switch (kind) {
    case "Égout bouché":
      return (
        <View style={styles.box}>
          <Burst color={INK} style={{ top: -2, left: 34 }} />
          <View style={{ marginTop: 22 }}>
            <Grate />
          </View>
          <MaterialCommunityIcons name="leaf-maple" size={40} color={ORANGE} style={{ position: "absolute", top: 12, right: 2, transform: [{ rotate: "20deg" }] }} />
          <MaterialCommunityIcons name="leaf-maple" size={36} color="#F2A12E" style={{ position: "absolute", bottom: -4, left: 8, transform: [{ rotate: "-25deg" }] }} />
        </View>
      );
    case "Eau accumulée":
      return (
        <View style={styles.box}>
          <View style={styles.drops}>
            <MaterialCommunityIcons name="water" size={18} color={BLUE} style={{ marginTop: 8 }} />
            <MaterialCommunityIcons name="water" size={20} color={BLUE} />
            <MaterialCommunityIcons name="water" size={18} color={BLUE} style={{ marginTop: 10 }} />
          </View>
          <Grate />
          <View style={styles.water}>
            <MaterialCommunityIcons name="waves" size={40} color={BLUE} />
            <MaterialCommunityIcons name="waves" size={40} color={BLUE} style={{ marginLeft: -6 }} />
            <MaterialCommunityIcons name="waves" size={40} color={BLUE} style={{ marginLeft: -6 }} />
          </View>
        </View>
      );
    case "Feuilles":
      // Affaissement autour d'un égout.
      return (
        <View style={styles.box}>
          <View style={styles.sink}>
            <Crack style={{ left: -14, top: 18, width: 24, transform: [{ rotate: "-15deg" }] }} />
            <Crack style={{ right: -14, top: 14, width: 24, transform: [{ rotate: "20deg" }] }} />
            <Crack style={{ left: 18, bottom: -8, width: 18, transform: [{ rotate: "65deg" }] }} />
            <Crack style={{ right: 20, bottom: -8, width: 18, transform: [{ rotate: "-60deg" }] }} />
            <View style={styles.manhole}>
              {[0, 1, 2].map((i) => <View key={i} style={styles.manholeBar} />)}
            </View>
          </View>
        </View>
      );
    case "Autre":
      // Grille d'égout endommagée.
      return (
        <View style={styles.box}>
          <Burst color={ORANGE} style={{ top: -2, right: 26 }} />
          <View style={{ marginTop: 20 }}>
            <Grate broken />
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  box: {
    width: 120,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  grate: {
    width: 92,
    height: 46,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: METAL,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  bar: {
    width: 8,
    height: 28,
    borderRadius: 3,
    backgroundColor: INK,
  },
  brokenRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  grateLeft: {
    width: 46,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    transform: [{ rotate: "-6deg" }],
  },
  grateRight: {
    width: 60,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    transform: [{ rotate: "5deg" }],
  },
  crackGap: {
    width: 4,
  },
  burst: {
    position: "absolute",
    flexDirection: "row",
    gap: 6,
    zIndex: 2,
  },
  burstLine: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  drops: {
    flexDirection: "row",
    gap: 4,
    marginBottom: -2,
  },
  water: {
    position: "absolute",
    bottom: -14,
    flexDirection: "row",
  },
  sink: {
    width: 104,
    height: 58,
    borderRadius: 52,
    backgroundColor: "#B9B9AE",
    alignItems: "center",
    justifyContent: "center",
  },
  manhole: {
    width: 70,
    height: 38,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: METAL,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  manholeBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: INK,
  },
  crack: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: INK,
  },
});
