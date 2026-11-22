import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Texte as Text } from "@/components/texte";

import { Chargement, Vide } from "@/components/ville/etat-ecran";
import { couleurEquipe } from "@/components/ville/style";
import { useEndroits } from "@/hooks/use-endroits";
import { useTournees } from "@/hooks/use-tournees";
import { interventionDe, lieuDeEndroit } from "@/lib/interventions";
import { chargerAdresses } from "@/lib/officiel";
import { formaterHeure } from "@/lib/temps";
import { LIBELLES_CATEGORIE } from "@/types";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

// « Arrêts faits » du superviseur : par équipe, les arrêts déjà faits (heure réelle) puis le prochain à venir. Lecture seule :
// un arrêt fait règle tout de suite ses signalements, il n'y a pas de rapport à approuver.
export default function ArretsFaits() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { resultat, chargement } = useTournees();
  const { endroits } = useEndroits();
  const adresses = useMemo(() => chargerAdresses(), []);
  const tournees = resultat?.tournees ?? [];
  const total = tournees.reduce((n, t) => n + t.arrets.filter((a) => a.fait).length, 0);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={26} color={P.primary} />
        <Text style={styles.noteTexte}>Un arrêt fait règle tout de suite les signalements de l’endroit.</Text>
      </View>
      {chargement ? (
        <Chargement texte="Chargement des tournées…" />
      ) : tournees.length === 0 ? (
        <Vide texte="Aucune tournée pour le moment." />
      ) : (
        tournees.map((t, i) => {
          const ordre = [...t.arrets].sort((a, b) => a.rang - b.rang);
          const faits = ordre.filter((a) => a.fait);
          const prochain = ordre.find((a) => !a.fait);
          const lignes = [...faits.slice(0, 12), ...(prochain ? [prochain] : [])];
          return (
            <View key={t.equipe_id} style={{ gap: 10 }} accessible={false}>
              <View style={styles.equipe} accessible accessibilityLabel={`${t.equipe_nom} : ${faits.length} arrêts faits sur ${t.arrets.length}`}>
                <View style={[styles.point, { backgroundColor: couleurEquipe(i) }]} />
                <Text style={styles.equipeNom}>{t.equipe_nom}</Text>
                <Text style={styles.pastille}>
                  {faits.length} sur {t.arrets.length}
                </Text>
              </View>
              {lignes.length === 0 || faits.length === 0 ? (
                <View style={styles.carte}>
                  <Text style={styles.vide}>Aucun arrêt fait pour l’instant.</Text>
                </View>
              ) : null}
              {lignes.length > 0 && faits.length > 0 ? (
                <View style={styles.carte}>
                  {lignes.map((a, n) => {
                    const e = endroits.find((x) => x.cle === a.cle_endroit);
                    const inter = e ? interventionDe(e) : null;
                    const titre = inter ? LIBELLES_CATEGORIE[inter.categorie] : "Intervention";
                    const detail = a.fait ? lieuDeEndroit(a.position, adresses) : `Prévu vers ${formaterHeure(a.arrivee_prevue)}`;
                    const heure = a.fait ? (a.fait_le ? formaterHeure(a.fait_le) : "Fait") : "À venir";
                    return (
                      <View key={a.rang}>
                        {n > 0 ? <View style={styles.separateur} /> : null}
                        <View style={styles.ligne} accessible accessibilityLabel={`Arrêt ${a.rang}, ${titre}, ${detail}, ${heure}`}>
                          <Text style={[styles.numero, { backgroundColor: a.fait ? P.success : P.borderForte }]}>{a.rang}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ligneTitre}>{titre}</Text>
                            <Text style={styles.ligneDetail}>{detail}</Text>
                          </View>
                          <Text style={[styles.heure, !a.fait && { color: P.textSecondary }]}>{heure}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
      {tournees.length > 0 && total === 0 ? <Text style={styles.sous}>Aucun arrêt n’est encore marqué comme fait.</Text> : null}
    </ScrollView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  page: { padding: 20, gap: 16, maxWidth: 800, width: "100%", alignSelf: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.bandeau, borderRadius: 20, padding: 14 },
  noteTexte: { flex: 1, fontSize: 14, fontWeight: "500", color: P.primary, lineHeight: 20 },
  equipe: { flexDirection: "row", alignItems: "center", gap: 10 },
  point: { width: 14, height: 14, borderRadius: 7 },
  equipeNom: { flex: 1, fontSize: 17, fontWeight: "700", color: P.text },
  pastille: { backgroundColor: P.bandeau, color: P.primary, fontSize: 14, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: "hidden" },
  carte: { backgroundColor: P.surface, borderRadius: 22, padding: 16 },
  separateur: { height: 1, backgroundColor: P.border, marginVertical: 10 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12 },
  numero: { width: 32, height: 32, borderRadius: 16, textAlign: "center", lineHeight: 32, color: "#FFFFFF", fontWeight: "700", fontSize: 15, overflow: "hidden" },
  ligneTitre: { fontSize: 15, fontWeight: "700", color: P.text },
  ligneDetail: { fontSize: 13, fontWeight: "500", color: P.textSecondary },
  heure: { fontSize: 14, fontWeight: "700", color: P.primary },
  vide: { fontSize: 14, fontWeight: "500", color: P.textSecondary },
  sous: { color: P.textSecondary, fontSize: 14 },
});
