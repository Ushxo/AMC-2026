import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Palette } from "@/constants/theme";
import { Bouton } from "@/components/ville/bouton";
import { Chargement, Erreur } from "@/components/ville/etat-ecran";
import { Resume } from "@/components/ville/resume";
import { useResumeVille } from "@/hooks/use-resume-ville";
import { useTournees } from "@/hooks/use-tournees";
import { resumeToutesEquipes } from "@/lib/durees";

// Tableau de bord du superviseur : où en sont les signalements, et le plan des équipes en place.
export default function TableauDeBord() {
  const router = useRouter();
  const { resume, chargement, erreur } = useResumeVille();
  const { resultat } = useTournees();
  const actifs = resume.parEtat.nouveau + resume.parEtat.pris_en_charge;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.titre} accessibilityRole="header">
        Tableau de bord
      </Text>
      <Text style={styles.sous}>Suivi des signalements d’égouts et des tournées des équipes.</Text>
      {chargement ? (
        <Chargement texte="Chargement du tableau de bord…" />
      ) : erreur ? (
        <Erreur message={erreur} />
      ) : (
        <>
          <View style={styles.rangee}>
            <View style={styles.carte} accessible accessibilityLabel={`${actifs} signalements à traiter`}>
              <Text style={styles.chiffre}>{actifs}</Text>
              <Text style={styles.legende}>à traiter</Text>
            </View>
            <View style={styles.carte} accessible accessibilityLabel={`${resume.parEtat.regle} signalements réglés`}>
              <Text style={styles.chiffre}>{resume.parEtat.regle}</Text>
              <Text style={styles.legende}>réglés</Text>
            </View>
          </View>
          <View style={styles.bloc}>
            <Text style={styles.sousTitre} accessibilityRole="header">
              Plan des équipes
            </Text>
            <Text style={styles.legende}>
              {resultat && resultat.tournees.length > 0 ? resumeToutesEquipes(resultat.tournees, resultat.totaux) : "Aucun plan pour le moment. Lancez l’optimisation."}
            </Text>
          </View>
          <Resume resume={resume} />
          <Bouton titre="Voir la carte des signalements" variante="discret" pleineLargeur onPress={() => router.push("/ville/carte")} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 14, maxWidth: 800, width: "100%", alignSelf: "center" },
  titre: { fontSize: 28, fontWeight: "800", color: Palette.header },
  sous: { color: Palette.textSecondary, fontSize: 15 },
  rangee: { flexDirection: "row", gap: 12 },
  carte: { flex: 1, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Palette.border },
  chiffre: { fontSize: 34, fontWeight: "800", color: Palette.header },
  legende: { color: Palette.textSecondary, fontSize: 14 },
  bloc: { backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 4, borderWidth: 1, borderColor: Palette.border },
  sousTitre: { fontSize: 17, fontWeight: "800", color: Palette.header },
});
