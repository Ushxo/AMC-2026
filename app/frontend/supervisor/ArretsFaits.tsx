import React from "react";
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import { Texte as Text } from '@/components/texte';

import { Palette } from "@/constants/theme";
import { Chargement, Vide } from "@/components/ville/etat-ecran";
import { useTournees } from "@/hooks/use-tournees";
import { formaterDate, formaterNombre } from "@/lib/format";
import { formaterHeure } from "@/lib/temps";
import type { Arret } from "@/types";

const ORANGE = "#E0661C";

/** Évaluation d'un arrêt telle que la base la garde : un arrêt « fait » sans évaluation compte comme réparé. */
function etatArret(a: Arret): "repare" | "non_regle" | null {
  if (a.evalue_le && a.regle === false) return "non_regle";
  if (a.fait || (a.evalue_le && a.regle)) return "repare";
  return null;
}

// « Rapports » du superviseur : ce que chaque équipe a évalué sur place (réparé, ou pas réglé avec un commentaire),
// et si l'équipe a envoyé son rapport. Les arrêts réparés règlent leurs signalements ; les autres restent ouverts.
export default function ArretsFaits() {
  const { resultat, chargement } = useTournees();
  const tournees = resultat?.tournees ?? [];
  const total = tournees.reduce((n, t) => n + t.arrets.filter((a) => etatArret(a)).length, 0);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.titre} accessibilityRole="header">
        Rapports des équipes
      </Text>
      <Text style={styles.sous}>Chaque arrêt est évalué sur place : réparé, ou pas réglé avec un commentaire. Les arrêts pas réglés restent à planifier.</Text>
      {chargement ? (
        <Chargement texte="Chargement des tournées…" />
      ) : tournees.length === 0 ? (
        <Vide texte="Aucune tournée pour le moment." />
      ) : total === 0 ? (
        <Vide texte="Aucun arrêt évalué pour le moment." />
      ) : (
        tournees.map((t) => {
          const evalues = t.arrets.filter((a) => etatArret(a));
          const nonRegles = evalues.filter((a) => etatArret(a) === "non_regle").length;
          return (
            <View
              key={t.equipe_id}
              style={styles.carte}
              accessible
              accessibilityLabel={`${t.equipe_nom} : ${evalues.length} arrêts évalués sur ${t.arrets.length}, ${nonRegles} pas réglés${t.rapport_envoye_le ? ", rapport envoyé" : ""}`}
            >
              <View style={styles.entete}>
                <Text style={styles.nom}>{t.equipe_nom}</Text>
                {t.rapport_envoye_le ? (
                  <Text style={[styles.pastille, styles.envoye]}>Rapport reçu</Text>
                ) : (
                  <Text style={[styles.pastille, styles.enCours]}>En cours</Text>
                )}
              </View>
              <Text style={styles.legende}>
                {formaterNombre(evalues.length, "arrêt évalué", "arrêts évalués")} sur {t.arrets.length}
                {nonRegles ? ` · ${formaterNombre(nonRegles, "pas réglé", "pas réglés")}` : ""}
                {t.rapport_envoye_le ? ` · envoyé le ${formaterDate(t.rapport_envoye_le)}` : ""}
              </Text>
              {evalues.slice(0, 12).map((a) => {
                const etat = etatArret(a);
                const moment = a.evalue_le ?? a.fait_le;
                return (
                  <View key={a.rang} style={styles.ligne}>
                    <Ionicons
                      name={etat === "non_regle" ? "alert-circle" : "checkmark-circle"}
                      size={18}
                      color={etat === "non_regle" ? ORANGE : Palette.header}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ligneTexte}>
                        {a.rang}. {etat === "non_regle" ? "Pas réglé" : "Réparé"}
                        {moment ? ` à ${formaterHeure(moment)}` : ""} · {formaterNombre(a.signalement_ids.length, "signalement", "signalements")}
                      </Text>
                      {etat === "non_regle" && a.commentaire ? <Text style={styles.commentaire}>« {a.commentaire} »</Text> : null}
                    </View>
                  </View>
                );
              })}
              {evalues.length > 12 ? <Text style={styles.legende}>… et {evalues.length - 12} autres</Text> : null}
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
  carte: { backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 6, borderWidth: 1, borderColor: Palette.border },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nom: { fontSize: 17, fontWeight: "800", color: Palette.header },
  pastille: { fontSize: 13, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: "hidden" },
  envoye: { color: Palette.header, backgroundColor: "#E3EED8" },
  enCours: { color: ORANGE, backgroundColor: "#FCE5D2" },
  legende: { color: Palette.textSecondary, fontSize: 14 },
  ligne: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  ligneTexte: { color: Palette.text, fontSize: 14 },
  commentaire: { color: Palette.text, fontSize: 14, fontStyle: "italic", marginTop: 2 },
});
