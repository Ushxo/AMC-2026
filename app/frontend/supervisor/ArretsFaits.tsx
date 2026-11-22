import React from "react";
import { ScrollView, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';

import { Palette } from "@/constants/theme";
import { Chargement, Vide } from "@/components/ville/etat-ecran";
import { useTournees } from "@/hooks/use-tournees";
import { formaterNombre } from "@/lib/format";
import { formaterHeure } from "@/lib/temps";

// « Rapports » du superviseur : les arrêts faits par chaque équipe (lecture seule).
// Les arrêts faits règlent directement leurs signalements : il n'y a pas de rapport à approuver.
export default function ArretsFaits() {
  const { resultat, chargement } = useTournees();
  const tournees = resultat?.tournees ?? [];
  const total = tournees.reduce((n, t) => n + t.arrets.filter((a) => a.fait).length, 0);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.titre} accessibilityRole="header">
        Arrêts faits
      </Text>
      <Text style={styles.sous}>Ce que les équipes ont déjà fait. Un arrêt fait règle ses signalements tout de suite.</Text>
      {chargement ? (
        <Chargement texte="Chargement des tournées…" />
      ) : tournees.length === 0 ? (
        <Vide texte="Aucune tournée pour le moment." />
      ) : total === 0 ? (
        <Vide texte="Aucun arrêt fait pour le moment." />
      ) : (
        tournees.map((t) => {
          const faits = t.arrets.filter((a) => a.fait);
          return (
            <View key={t.equipe_id} style={styles.carte} accessible accessibilityLabel={`${t.equipe_nom} : ${faits.length} arrêts faits sur ${t.arrets.length}`}>
              <Text style={styles.nom}>{t.equipe_nom}</Text>
              <Text style={styles.legende}>
                {formaterNombre(faits.length, "arrêt fait", "arrêts faits")} sur {t.arrets.length}
              </Text>
              {faits.slice(0, 12).map((a) => (
                <Text key={a.rang} style={styles.ligne}>
                  {a.rang}. {a.fait_le ? `fait à ${formaterHeure(a.fait_le)}` : "fait"} · {formaterNombre(a.signalement_ids.length, "signalement", "signalements")}
                </Text>
              ))}
              {faits.length > 12 ? <Text style={styles.legende}>… et {faits.length - 12} autres</Text> : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
  titre: { fontSize: 28, fontWeight: "800", color: Palette.header },
  sous: { color: Palette.textSecondary, fontSize: 15 },
  carte: { backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 4, borderWidth: 1, borderColor: Palette.border },
  nom: { fontSize: 17, fontWeight: "800", color: Palette.header },
  legende: { color: Palette.textSecondary, fontSize: 14 },
  ligne: { color: Palette.text, fontSize: 14 },
});
