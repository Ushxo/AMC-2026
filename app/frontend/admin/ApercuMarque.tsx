import React from "react";
import { StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";

import { LogoMarque } from "@/components/logo-marque";
import type { Jetons } from "@/marque/jetons";

// Aperçu en direct de la marque en cours de réglage : en-tête, carte, étiquette, bouton d'action et barre du bas, avec les couleurs du brouillon.
export function ApercuMarque({ jetons, nomApp, slogan, logo }: { jetons: Jetons; nomApp: string; slogan: string | null; logo: string }) {
  return (
    <View style={[styles.cadre, { backgroundColor: jetons.background, borderColor: jetons.border }]} accessibilityLabel={`Aperçu de la marque ${nomApp}`} accessible>
      <View style={[styles.entete, { backgroundColor: jetons.header }]}>
        <LogoMarque taille={40} cle={logo} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.nom, { color: jetons.onHeader }]} numberOfLines={1}>
            {nomApp || "Nom de l'app"}
          </Text>
          {slogan ? (
            <Text style={[styles.slogan, { color: jetons.onHeaderSoft }]} numberOfLines={1}>
              {slogan}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.corps}>
        <View style={[styles.carte, { backgroundColor: jetons.surface, borderColor: jetons.border }]}>
          <Text style={[styles.titreCarte, { color: jetons.text }]}>Égout bouché</Text>
          <Text style={[styles.sousCarte, { color: jetons.textSecondary }]}>Rue Saint-Denis, Montréal</Text>
          <View style={styles.ligne}>
            <Text style={[styles.etiquette, { backgroundColor: jetons.actionDoux, color: jetons.onActionDoux }]}>En cours</Text>
            <Text style={[styles.etiquette, { backgroundColor: jetons.bandeau, color: jetons.onBandeau }]}>Passage prévu</Text>
          </View>
        </View>
        <View style={[styles.bouton, { backgroundColor: jetons.action }]}>
          <Text style={[styles.boutonTexte, { color: jetons.onAction }]}>Signaler un problème</Text>
        </View>
      </View>
      <View style={[styles.barre, { backgroundColor: jetons.background, borderTopColor: jetons.border }]}>
        <Text style={[styles.onglet, { backgroundColor: jetons.backgroundSelected, color: jetons.primary }]}>Carte</Text>
        <Text style={[styles.onglet, { color: jetons.textSecondary }]}>Mes alertes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  entete: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  nom: { fontSize: 18, fontWeight: "700" },
  slogan: { fontSize: 12, fontWeight: "500" },
  corps: { padding: 14, gap: 12 },
  carte: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 4 },
  titreCarte: { fontSize: 15, fontWeight: "700" },
  sousCarte: { fontSize: 12, fontWeight: "500" },
  ligne: { flexDirection: "row", gap: 8, marginTop: 6 },
  etiquette: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: "hidden" },
  bouton: { height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  boutonTexte: { fontSize: 15, fontWeight: "700" },
  barre: { flexDirection: "row", justifyContent: "space-around", padding: 8, borderTopWidth: 1 },
  onglet: { fontSize: 13, fontWeight: "700", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, overflow: "hidden" },
});
