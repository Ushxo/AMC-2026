import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { FeuilleProfil } from "@/components/profil/feuille-profil";
import { useTheme } from "@/hooks/use-theme";

type Props = Omit<React.ComponentProps<typeof FeuilleProfil>, "visible" | "onFermer">;

// Icône de profil des en-têtes : ouvre la feuille du profil (apparence, changement de ville, compte).
export function BoutonProfil(props: Props) {
  const P = useTheme();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOuvert(true)} accessibilityRole="button" accessibilityLabel="Mon profil, apparence et compte" hitSlop={8} style={styles.profil}>
        <Ionicons name="person-circle-outline" size={46} color={P.onHeader} />
      </Pressable>
      <FeuilleProfil {...props} visible={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  profil: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
