import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Texte as Text } from "@/components/texte";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Chargement, Erreur } from "@/components/ville/etat-ecran";
import { Resume } from "@/components/ville/resume";
import { couleurEquipe } from "@/components/ville/style";
import { useEndroits } from "@/hooks/use-endroits";
import { useResumeVille } from "@/hooks/use-resume-ville";
import { useTournees } from "@/hooks/use-tournees";
import { formaterNombre } from "@/lib/format";
import { formaterDuree } from "@/lib/interventions";
import { gravitesDisponibles } from "@/lib/selection";
import { estPartiel, resumerGain } from "@/lib/tournees";
import { LIBELLES_GRAVITE, type Gravite } from "@/types";
import { IMPORTANCE } from "./InterventionsAPlanifier";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

const GRAVITES: Gravite[] = ["elevee", "moyenne", "faible"];

// Tableau de bord du superviseur : à traiter et réglés, plan des équipes, répartition par importance, gain du dernier calcul.
export default function TableauDeBord() {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const router = useRouter();
  const { resume, chargement, erreur } = useResumeVille();
  const { resultat } = useTournees();
  const { endroits } = useEndroits();
  const parGravite = useMemo(() => gravitesDisponibles(endroits), [endroits]);
  const ouverts = parGravite.elevee + parGravite.moyenne + parGravite.faible;
  const tournees = resultat?.tournees ?? [];
  const dureeTotale = tournees.reduce((t, q) => t + (q.duree_s || 0), 0);
  const gain = resultat && resultat.comparaison && !estPartiel(resultat) ? resumerGain(resultat.comparaison) : null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {chargement ? (
        <Chargement texte="Chargement du tableau de bord…" />
      ) : erreur ? (
        <Erreur message={erreur} />
      ) : (
        <>
          <View style={styles.deux}>
            <View style={styles.tuile} accessible accessibilityLabel={`${ouverts} endroits à traiter`}>
              <Text style={styles.tuileLegende}>À traiter</Text>
              <Text style={[styles.tuileChiffre, { color: P.action }]}>{ouverts}</Text>
              <Text style={styles.tuileNote}>endroits signalés</Text>
            </View>
            <View style={styles.tuile} accessible accessibilityLabel={`${resume.parEtat.regle} signalements réglés`}>
              <Text style={styles.tuileLegende}>Réglés</Text>
              <Text style={[styles.tuileChiffre, { color: P.success }]}>{resume.parEtat.regle}</Text>
              <Text style={styles.tuileNote}>signalements</Text>
            </View>
          </View>

          <View style={styles.plan}>
            <View style={styles.planEntete}>
              <Text style={styles.planTitre} accessibilityRole="header">
                Plan des équipes
              </Text>
              {tournees.length > 0 ? <Text style={styles.pastille}>{formaterDuree(dureeTotale)}</Text> : null}
            </View>
            {tournees.length === 0 ? (
              <Text style={styles.planNote}>Aucun plan pour le moment. Lancez l’optimisation.</Text>
            ) : (
              tournees.map((t, i) => {
                const faits = t.arrets.filter((a) => a.fait).length;
                const pct = t.arrets.length > 0 ? Math.round((faits / t.arrets.length) * 100) : 0;
                return (
                  <View key={t.equipe_id} style={{ gap: 6 }} accessible accessibilityLabel={`${t.equipe_nom} : ${formaterNombre(t.arrets.length, "arrêt", "arrêts")}, ${formaterDuree(t.duree_s)}, ${faits} faits`}>
                    <View style={styles.equipeLigne}>
                      <View style={[styles.point, { backgroundColor: couleurEquipe(i) }]} />
                      <Text style={styles.equipeNom}>{t.equipe_nom}</Text>
                      <Text style={styles.equipeDetail}>
                        {formaterNombre(t.arrets.length, "arrêt", "arrêts")} · {formaterDuree(t.duree_s)}
                      </Text>
                    </View>
                    <View style={styles.piste}>
                      <View style={[styles.remplissage, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
            <Pressable onPress={() => router.push("/ville/carte")} accessibilityRole="button" style={styles.lien}>
              <Text style={styles.lienTexte}>Voir les endroits signalés sur la carte</Text>
            </Pressable>
          </View>

          <View style={styles.bloc}>
            <Text style={styles.planTitre} accessibilityRole="header">
              Par importance
            </Text>
            {GRAVITES.map((g) => {
              const c = IMPORTANCE[g];
              const pct = ouverts > 0 ? Math.round((parGravite[g] / ouverts) * 100) : 0;
              return (
                <View key={g} style={styles.equipeLigne} accessible accessibilityLabel={`${LIBELLES_GRAVITE[g]} : ${parGravite[g]}`}>
                  <Text style={[styles.etiquette, { backgroundColor: c.fond, color: c.plein }]} maxFontSizeMultiplier={1.2}>
                    {LIBELLES_GRAVITE[g]}
                  </Text>
                  <View style={[styles.piste, { flex: 1, height: 10, backgroundColor: P.backgroundElement }]}>
                    <View style={[styles.remplissage, { width: `${pct}%`, height: 10, backgroundColor: c.plein }]} />
                  </View>
                  <Text style={styles.compte}>{parGravite[g]}</Text>
                </View>
              );
            })}
          </View>

          {gain ? (
            <View style={styles.bloc}>
              <Text style={styles.planTitre} accessibilityRole="header">
                Gain du dernier calcul
              </Text>
              {gain.egal.map((l) => (
                <Text key={l.etiquette} style={styles.gain}>
                  {l.etiquette} : {l.valeur}
                </Text>
              ))}
              <Text style={styles.gain}>{gain.dansLeQuart}</Text>
              <Text style={styles.planNote}>Selon notre règle de comparaison, sur des données simulées. Ces chiffres valent pour le plan complet (tous les endroits), pas pour une sélection.</Text>
            </View>
          ) : null}

          <Resume resume={resume} />
        </>
      )}
    </ScrollView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  page: { padding: 20, gap: 16, maxWidth: 800, width: "100%", alignSelf: "center" },
  deux: { flexDirection: "row", gap: 12 },
  tuile: { flex: 1, backgroundColor: P.surface, borderRadius: 22, padding: 18, gap: 6 },
  tuileLegende: { fontSize: 14, fontWeight: "600", color: P.textSecondary },
  tuileChiffre: { fontSize: 36, lineHeight: 46, fontWeight: "700" },
  tuileNote: { fontSize: 13, fontWeight: "500", color: P.textSecondary },
  plan: { backgroundColor: P.bandeau, borderRadius: 22, padding: 18, gap: 12 },
  planEntete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  planTitre: { fontSize: 17, fontWeight: "700", color: P.primary },
  planNote: { fontSize: 14, fontWeight: "500", color: P.textSecondary, lineHeight: 20 },
  pastille: { backgroundColor: P.surface, color: P.primary, fontSize: 14, fontWeight: "700", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: "hidden" },
  equipeLigne: { flexDirection: "row", alignItems: "center", gap: 10 },
  point: { width: 14, height: 14, borderRadius: 7 },
  equipeNom: { fontSize: 15, fontWeight: "600", flex: 1, color: P.primary },
  equipeDetail: { fontSize: 14, fontWeight: "500", color: P.textSecondary },
  piste: { height: 8, borderRadius: 4, backgroundColor: P.surface, overflow: "hidden" },
  remplissage: { height: 8, borderRadius: 4, backgroundColor: P.header },
  lien: { minHeight: 48, justifyContent: "center" },
  lienTexte: { fontSize: 15, fontWeight: "700", color: P.primary, textDecorationLine: "underline" },
  bloc: { backgroundColor: P.surface, borderRadius: 22, padding: 18, gap: 12 },
  etiquette: { fontSize: 13, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: "hidden", width: 88, textAlign: "center" },
  compte: { fontSize: 14, fontWeight: "700", minWidth: 28, textAlign: "right", color: P.text },
  gain: { fontSize: 15, fontWeight: "500", color: P.textSecondary, lineHeight: 21 },
});
