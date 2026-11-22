import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";
import { BarreProgression } from "@/components/ville/barre-progression";
import { CarteTournees } from "@/components/ville/carte-tournees";
import { Chargement, Vide } from "@/components/ville/etat-ecran";
import { couleurEquipe } from "@/components/ville/style";
import { useEndroits } from "@/hooks/use-endroits";
import { useEquipes } from "@/hooks/use-equipes";
import { useOptimisation } from "@/hooks/use-optimisation";
import { useProgressionOptimisation } from "@/hooks/use-progression-optimisation";
import { useSessionEmploye } from "@/hooks/use-session-employe";
import { useSource } from "@/hooks/use-source";
import { useTournees } from "@/hooks/use-tournees";
import { formaterDuree, interventionDe, lieuDeEndroit } from "@/lib/interventions";
import { MESSAGE_AUCUNE_TOURNEE, MESSAGE_OPTIMISATION_ECHEC, MESSAGE_OPTIMISATION_EN_COURS, MESSAGE_RESULTAT_PRECALCULE } from "@/lib/messages";
import { chargerRegion, chargerAdresses } from "@/lib/officiel";
import { OPTIONS_PAR_DEFAUT, parametresDesOptions } from "@/lib/options-calcul";
import { endroitsOuverts, selectionAEnvoyer } from "@/lib/selection";
import { dateProchainQuart } from "@/lib/temps";
import { LIBELLES_CATEGORIE, LIBELLES_GRAVITE, type Gravite } from "@/types";
import { ILLUSTRATION_PAR_CATEGORIE, ProblemIllustration } from "../components/ProblemIllustration";
import { IMPORTANCE } from "./InterventionsAPlanifier";

/**
 * Écran « Trajet optimal » : lance notre optimisation sur la sélection de la liste, puis montre le trajet de chaque équipe
 * (tracé, arrêts numérotés, interventions dans l'ordre). Le détail complet du calcul reste dans l'onglet Optimisation.
 */
export default function TrajetOptimal({ cles, onRetour, onDetails }: { cles: string[]; onRetour: () => void; onDetails: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { peutGerer } = useSessionEmploye();
  const { endroits } = useEndroits();
  const ouverts = useMemo(() => endroitsOuverts(endroits), [endroits]);
  const { equipes, chargement: equipesEnChargement } = useEquipes();
  const { resultat, source, chargement } = useTournees();
  const { lancer, demande, enCours, basculeSurPrecalcule, message } = useOptimisation();
  const region = useMemo(() => chargerRegion(), []);
  const adresses = useMemo(() => chargerAdresses(), []);
  const [choix, setChoix] = useState<string | null>(null);
  const [lance, setLance] = useState(false);
  const dejaLance = useRef(false);

  // Le calcul part une seule fois, quand les endroits et les équipes sont chargés.
  useEffect(() => {
    if (dejaLance.current || ouverts.length === 0 || equipesEnChargement || !peutGerer) return;
    dejaLance.current = true;
    const envoyer = selectionAEnvoyer(cles, ouverts);
    const base = { date: dateProchainQuart(Date.now(), equipes.filter((e) => e.active).map((e) => e.debut_quart)), ...parametresDesOptions(OPTIONS_PAR_DEFAUT) };
    void lancer(envoyer ? { ...base, cles_endroits: envoyer } : base).then(() => setLance(true));
  });

  const tourneesAvecArrets = (resultat?.tournees ?? []).filter((t) => t.arrets.length > 0);
  const actif = tourneesAvecArrets.find((t) => t.equipe_id === choix) ?? tourneesAvecArrets[0];
  const tracesEnAttente = demande?.statut === "terminee" && !!resultat && resultat.tournees.some((t) => !t.geometrie);
  const progression = useProgressionOptimisation(demande, { envoi: enCours && !demande, tracesEnAttente });
  const echec = demande?.statut === "echec" ? (demande.message ?? MESSAGE_OPTIMISATION_ECHEC) : null;
  const calcul = (enCours && !basculeSurPrecalcule) || (peutGerer && !lance && !echec);
  const nombre = actif?.arrets.length ?? 0;

  return (
    <View style={styles.fond}>
      <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
        <StatusBar barStyle="light-content" />
        <Pressable onPress={onRetour} accessibilityRole="button" accessibilityLabel="Retour à la liste des interventions" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={30} color={Palette.onHeader} />
        </Pressable>
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Trajet optimal
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        {calcul ? (
          <View style={styles.bloc} accessibilityLiveRegion="polite">
            <Text style={styles.blocTitre}>{MESSAGE_OPTIMISATION_EN_COURS}</Text>
            <BarreProgression etape={progression.etape} fraction={progression.fraction} />
          </View>
        ) : echec ? (
          <Text style={styles.alerte} accessibilityRole="alert">
            {echec}
          </Text>
        ) : chargement ? (
          <Chargement texte="Chargement du trajet…" />
        ) : !resultat || !actif ? (
          <Vide texte={MESSAGE_AUCUNE_TOURNEE} />
        ) : (
          <>
            <View style={styles.genere}>
              <MaterialCommunityIcons name="map-marker-path" size={36} color={Palette.header} />
              <View style={{ flex: 1 }}>
                <Text style={styles.genereTitre} maxFontSizeMultiplier={1.3}>
                  Trajet généré
                </Text>
                <Text style={styles.genereSous} maxFontSizeMultiplier={1.3}>
                  Itinéraire optimisé pour {nombre} {nombre > 1 ? "interventions" : "intervention"}
                </Text>
              </View>
              <View style={styles.duree} accessibilityLabel={`Durée estimée ${formaterDuree(actif.duree_s)}`}>
                <Ionicons name="time-outline" size={20} color={Palette.text} />
                <Text style={styles.dureeTexte}>{formaterDuree(actif.duree_s)}</Text>
              </View>
            </View>
            {source === "precalcule" || (!peutGerer && etat === "repli") ? <Text style={styles.note}>{MESSAGE_RESULTAT_PRECALCULE}</Text> : null}

            {tourneesAvecArrets.length > 1 ? (
              <View style={styles.equipes}>
                {tourneesAvecArrets.map((t) => {
                  const i = resultat.tournees.findIndex((q) => q.equipe_id === t.equipe_id);
                  const sel = t.equipe_id === actif.equipe_id;
                  return (
                    <Pressable
                      key={t.equipe_id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: sel }}
                      onPress={() => setChoix(t.equipe_id)}
                      style={[styles.chip, sel && { backgroundColor: Palette.backgroundSelected }]}
                    >
                      <View style={[styles.pastille, { backgroundColor: couleurEquipe(i) }]} />
                      <Text style={styles.chipTexte}>{t.equipe_nom}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.carteCadre}>
              <CarteTournees resultat={resultat} equipes={equipes} region={region} choisi={null} equipeActive={actif.equipe_id} />
            </View>

            <Text style={styles.sousTitre} accessibilityRole="header">
              Interventions du trajet ({nombre})
            </Text>
            <View style={styles.liste}>
              {actif.arrets.map((a, n) => {
                const e = endroits.find((x) => x.cle === a.cle_endroit);
                const i = e ? interventionDe(e) : null;
                const gravite: Gravite = e?.gravite_affichee ?? "moyenne";
                const c = IMPORTANCE[gravite];
                const kind = i ? ILLUSTRATION_PAR_CATEGORIE[i.categorie] : undefined;
                const titre = i ? LIBELLES_CATEGORIE[i.categorie] : "Intervention";
                const lieu = lieuDeEndroit(a.position, adresses);
                return (
                  <View key={a.rang} style={styles.ligne} accessible accessibilityLabel={`${n + 1}. ${titre}, ${lieu}, importance ${LIBELLES_GRAVITE[gravite]}`}>
                    <View style={styles.colNum}>
                      {n < actif.arrets.length - 1 ? <View style={[styles.trait, { backgroundColor: c.plein }]} /> : null}
                      <View style={[styles.num, { backgroundColor: c.plein }]}>
                        <Text style={styles.numTexte}>{n + 1}</Text>
                      </View>
                    </View>
                    <View style={styles.dessin}>
                      {kind ? (
                        <View style={{ transform: [{ scale: 0.5 }] }}>
                          <ProblemIllustration kind={kind} />
                        </View>
                      ) : (
                        <Ionicons name="warning-outline" size={28} color={Palette.accent} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ligneTitre} maxFontSizeMultiplier={1.3}>
                        {titre}
                      </Text>
                      <Text style={styles.ligneLieu} numberOfLines={2}>
                        {lieu}
                      </Text>
                    </View>
                    <Text style={[styles.etiquette, { backgroundColor: c.fond, color: c.plein }]} maxFontSizeMultiplier={1.2}>
                      {LIBELLES_GRAVITE[gravite]}
                    </Text>
                  </View>
                );
              })}
            </View>
            {message ? (
              <Text style={styles.note} accessibilityRole="alert">
                {message}
              </Text>
            ) : null}
            <Pressable onPress={onDetails} accessibilityRole="button" style={styles.lien}>
              <Text style={styles.lienTexte}>Options et détails du calcul (équipes, gain, incident simulé)</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {actif && peutGerer && !calcul ? (
        <View style={[styles.bas, { paddingBottom: 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Suivre le trajet de l'équipe ${actif.equipe_nom}`}
            onPress={() => router.push({ pathname: "/ville/trajet/[equipe]", params: { equipe: actif.equipe_id } })}
            style={styles.suivre}
          >
            <MaterialCommunityIcons name="navigation-variant-outline" size={30} color={Palette.surface} />
            <View style={styles.separateur} />
            <Text style={styles.suivreTexte} maxFontSizeMultiplier={1.2}>
              Suivre ce trajet
            </Text>
            <Ionicons name="arrow-forward" size={28} color={Palette.surface} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: Palette.background },
  entete: { backgroundColor: Palette.header, paddingHorizontal: 18, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 14, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  retour: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  titre: { color: Palette.onHeader, fontSize: 28, fontWeight: "800" },
  page: { padding: 16, gap: 12, paddingBottom: 130, maxWidth: 800, width: "100%", alignSelf: "center" },
  bloc: { backgroundColor: Palette.surface, borderRadius: 22, padding: 16, gap: 10 },
  blocTitre: { fontSize: 17, fontWeight: "800", color: Palette.text },
  alerte: { fontSize: 16, color: Palette.danger, fontWeight: "700" },
  genere: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#DCEBD3", borderRadius: 22, padding: 14 },
  genereTitre: { fontSize: 22, fontWeight: "800", color: Palette.header },
  genereSous: { fontSize: 14, color: Palette.text },
  duree: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Palette.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  dureeTexte: { fontWeight: "800", fontSize: 16, color: Palette.text },
  note: { fontSize: 13, color: Palette.textSecondary },
  equipes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: Palette.borderForte, backgroundColor: Palette.surface },
  chipTexte: { fontSize: 15, color: Palette.text, fontWeight: "700" },
  pastille: { width: 14, height: 14, borderRadius: 7 },
  carteCadre: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: Palette.border },
  sousTitre: { fontSize: 22, fontWeight: "800", color: Palette.text, marginTop: 4 },
  liste: { backgroundColor: Palette.surface, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 10 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 78 },
  colNum: { width: 40, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  trait: { position: "absolute", width: 3, top: "50%", bottom: -39 },
  num: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  numTexte: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
  dessin: { width: 60, height: 52, alignItems: "center", justifyContent: "center" },
  ligneTitre: { fontSize: 16, fontWeight: "800", color: Palette.text },
  ligneLieu: { fontSize: 13, color: Palette.text },
  etiquette: { fontWeight: "800", fontSize: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, overflow: "hidden" },
  lien: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  lienTexte: { color: Palette.header, fontWeight: "800", textDecorationLine: "underline", fontSize: 14, textAlign: "center" },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  suivre: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#B84A0B", borderRadius: 32, paddingHorizontal: 22, minHeight: 72 },
  separateur: { width: 1, alignSelf: "stretch", marginVertical: 14, backgroundColor: "rgba(255,255,255,0.5)" },
  suivreTexte: { flex: 1, color: Palette.surface, fontSize: 21, fontWeight: "800" },
});
