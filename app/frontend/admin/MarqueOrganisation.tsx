import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";

import { Chargement } from "@/components/ville/etat-ecran";
import { Palette } from "@/constants/theme";
import { lireOrganisations, type Organisation } from "@/lib/organisations";

// Organisations et marque : la liste des organisations et leur marque (édition complète : lot suivant).
export default function MarqueOrganisation() {
  const [organisations, setOrganisations] = useState<Organisation[] | null>(null);
  useEffect(() => {
    void lireOrganisations().then((r) => setOrganisations(r.organisations));
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {!organisations ? (
        <Chargement texte="Chargement des organisations…" />
      ) : (
        organisations.map((o) => (
          <View key={o.code} style={styles.carte}>
            <Text style={styles.nom}>{o.nom_app}</Text>
            <Text style={styles.detail}>{o.nom}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 12 },
  carte: { backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 2 },
  nom: { fontSize: 17, fontWeight: "700", color: Palette.text },
  detail: { fontSize: 13, color: Palette.textSecondary },
});
