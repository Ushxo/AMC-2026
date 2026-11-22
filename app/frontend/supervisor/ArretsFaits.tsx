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
import { formaterDate } from "@/lib/format";
import { LIBELLES_CATEGORIE, type Arret } from "@/types";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { BLANC_FIXE, COULEURS_IMPORTANCE } from '@/components/ville/style';

const ORANGE = COULEURS_IMPORTANCE.moyenne.plein;

/** Évaluation d'un arrêt par l'équipe (migration 0009) : un arrêt « fait » sans évaluation compte comme réparé. */
function etatArret(a: Arret): "repare" | "non_regle" | null {
  if (a.evalue_le && a.regle === false) return "non_regle";
  if (a.fait || (a.evalue_le && a.regle)) return "repare";
  return null;
}

// « Rapports » du superviseur : par équipe, les arrêts évalués sur place (réparé, ou pas réglé avec un commentaire)
// puis le prochain à venir, et si l'équipe a envoyé son rapport. Un arrêt réparé règle tout de suite ses signalements ;
// un arrêt pas réglé les laisse ouverts, à replanifier.
export default function ArretsFaits() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { resultat, chargement } = useTournees();
  const { endroits } = useEndroits();
  const adresses = useMemo(() => chargerAdresses(), []);
  const tournees = resultat?.tournees ?? [];
  const total = tournees.reduce((n, t) => n + t.arrets.filter((a) => etatArret(a)).length, 0);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={26} color={P.primary} />
        <Text style={styles.noteTexte}>Un arrêt réparé règle tout de suite les signalements de l’endroit. Un arrêt pas réglé les laisse ouverts, avec le commentaire de l’équipe.</Text>
      </View>
      {chargement ? (
        <Chargement texte="Chargement des tournées…" />
      ) : tournees.length === 0 ? (
        <Vide texte="Aucune tournée pour le moment." />
      ) : (
        tournees.map((t, i) => {
          const ordre = [...t.arrets].sort((a, b) => a.rang - b.rang);
          const faits = ordre.filter((a) => etatArret(a));
          const prochain = ordre.find((a) => !etatArret(a));
          const lignes = [...faits.slice(0, 12), ...(prochain ? [prochain] : [])];
          return (
            <View key={t.equipe_id} style={{ gap: 10 }} accessible={false}>
              <View style={styles.equipe} accessible accessibilityLabel={`${t.equipe_nom} : ${faits.length} arrêts faits sur ${t.arrets.length}${t.rapport_envoye_le ? ", rapport reçu" : ""}`}>
                <View style={[styles.point, { backgroundColor: couleurEquipe(i) }]} />
                <Text style={styles.equipeNom}>{t.equipe_nom}</Text>
                <Text style={styles.pastille}>
                  {faits.length} sur {t.arrets.length}
                </Text>
              </View>
              {t.rapport_envoye_le ? (
                <Text style={styles.rapport}>Rapport reçu le {formaterDate(t.rapport_envoye_le)}</Text>
              ) : null}
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
                    const etat = etatArret(a);
                    const moment = a.evalue_le ?? a.fait_le;
                    const detail = etat ? lieuDeEndroit(a.position, adresses) : `Prévu vers ${formaterHeure(a.arrivee_prevue)}`;
                    const heure = etat === "non_regle" ? "Pas réglé" : etat ? (moment ? formaterHeure(moment) : "Fait") : "À venir";
                    const couleur = etat === "non_regle" ? ORANGE : etat ? P.success : P.borderForte;
                    return (
                      <View key={a.rang}>
                        {n > 0 ? <View style={styles.separateur} /> : null}
                        <View style={styles.ligne} accessible accessibilityLabel={`Arrêt ${a.rang}, ${titre}, ${detail}, ${heure}${a.commentaire && etat === "non_regle" ? `, ${a.commentaire}` : ""}`}>
                          <Text style={[styles.numero, { backgroundColor: couleur }]}>{a.rang}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ligneTitre}>{titre}</Text>
                            <Text style={styles.ligneDetail}>{detail}</Text>
                            {etat === "non_regle" && a.commentaire ? <Text style={styles.commentaire}>« {a.commentaire} »</Text> : null}
                          </View>
                          <Text style={[styles.heure, !etat && { color: P.textSecondary }, etat === "non_regle" && { color: ORANGE }]}>{heure}</Text>
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
  numero: { width: 32, height: 32, borderRadius: 16, textAlign: "center", lineHeight: 32, color: BLANC_FIXE, fontWeight: "700", fontSize: 15, overflow: "hidden" },
  ligneTitre: { fontSize: 15, fontWeight: "700", color: P.text },
  ligneDetail: { fontSize: 13, fontWeight: "500", color: P.textSecondary },
  heure: { fontSize: 14, fontWeight: "700", color: P.primary },
  vide: { fontSize: 14, fontWeight: "500", color: P.textSecondary },
  commentaire: { fontSize: 13, fontStyle: "italic", color: P.text, marginTop: 2 },
  rapport: { fontSize: 14, fontWeight: "700", color: P.success },
  sous: { color: P.textSecondary, fontSize: 14 },
});
