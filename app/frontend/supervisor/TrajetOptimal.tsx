import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import {
  MESSAGE_AUCUNE_TOURNEE,
  MESSAGE_OPTIMISATION_ECHEC,
  MESSAGE_OPTIMISATION_EN_COURS,
  MESSAGE_OPTIMISATION_PRECALCULEE,
  MESSAGE_PRECALCULE_TOUS_ENDROITS,
  MESSAGE_RESULTAT_PRECALCULE,
} from "@/lib/messages";
import { chargerRegion, chargerAdresses } from "@/lib/officiel";
import { OPTIONS_PAR_DEFAUT, parametresDesOptions } from "@/lib/options-calcul";
import { endroitsOuverts, nettoyerSelection, selectionAEnvoyer } from "@/lib/selection";
import { dateProchainQuart } from "@/lib/temps";
import { LIBELLES_CATEGORIE, LIBELLES_GRAVITE, type Gravite } from "@/types";
import { IllustrationProbleme } from "@/components/illustration-probleme";
import { IMPORTANCE } from "./InterventionsAPlanifier";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { FOND_AVERTISSEMENT, BLANC_FIXE } from '@/components/ville/style';
import { BoutonAction } from '@/components/bouton-action';

/**
 * Écran « Trajet optimal » : lance notre optimisation sur la sélection de la liste, puis montre le trajet de chaque équipe
 * (tracé, arrêts numérotés, interventions dans l'ordre). Le détail complet du calcul reste dans l'onglet Optimisation.
 */
export default function TrajetOptimal({ cles, onRetour, onDetails }: { cles: string[]; onRetour: () => void; onDetails: () => void }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { peutGerer } = useSessionEmploye();
  const { endroits, chargement: endroitsEnChargement } = useEndroits();
  const ouverts = useMemo(() => endroitsOuverts(endroits), [endroits]);
  const { equipes, chargement: equipesEnChargement } = useEquipes();
  const { resultat, source, chargement } = useTournees();
  const { lancer, demande, enCours, basculeSurPrecalcule, message } = useOptimisation();
  const region = useMemo(() => chargerRegion(), []);
  const adresses = useMemo(() => chargerAdresses(), []);
  const [choix, setChoix] = useState<string | null>(null);
  const [lance, setLance] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [delaiDepasse, setDelaiDepasse] = useState(false);
  const dejaLance = useRef(false);
  // La sélection nettoyée : une sélection vide ne part JAMAIS au service (il la lirait comme « tous les endroits »).
  const propres = useMemo(() => nettoyerSelection(cles, ouverts), [cles, ouverts]);
  const aucunEndroit = !endroitsEnChargement && propres.length === 0;

  // Le calcul part une seule fois, quand les endroits et les équipes sont chargés et que la sélection n'est pas vide.
  useEffect(() => {
    if (dejaLance.current || endroitsEnChargement || propres.length === 0 || equipesEnChargement || !peutGerer) return;
    dejaLance.current = true;
    const envoyer = selectionAEnvoyer(propres, ouverts);
    const base = { date: dateProchainQuart(Date.now(), equipes.filter((e) => e.active).map((e) => e.debut_quart)), ...parametresDesOptions(OPTIONS_PAR_DEFAUT) };
    void lancer(envoyer ? { ...base, cles_endroits: envoyer } : base).then((m) => {
      setRefus(m);
      setLance(true);
    });
  });

  // Jamais d'attente sans fin : si rien ne s'est passé au bout de 45 s, l'écran le dit.
  useEffect(() => {
    if (!peutGerer || lance || aucunEndroit) return;
    const t = setTimeout(() => setDelaiDepasse(true), 45000);
    return () => clearTimeout(t);
  }, [peutGerer, lance, aucunEndroit]);

  const tourneesAvecArrets = (resultat?.tournees ?? []).filter((t) => t.arrets.length > 0);
  const actif = tourneesAvecArrets.find((t) => t.equipe_id === choix) ?? tourneesAvecArrets[0];
  const tracesEnAttente = demande?.statut === "terminee" && !!resultat && resultat.tournees.some((t) => !t.geometrie);
  const progression = useProgressionOptimisation(demande, { envoi: enCours && !demande, tracesEnAttente });
  const echec = demande?.statut === "echec" ? (demande.message ?? MESSAGE_OPTIMISATION_ECHEC) : null;
  const calcul = (enCours && !basculeSurPrecalcule) || (peutGerer && !lance && !echec && !aucunEndroit && !delaiDepasse);
  // La raison d'un refus ou d'un échec est toujours visible, avec ou sans plan.
  const raison = refus ?? echec ?? (delaiDepasse && !lance ? "Le calcul ne répond pas. Revenez à la liste et réessayez." : null);
  const nombre = actif?.arrets.length ?? 0;
  const selectionPartielle = selectionAEnvoyer(propres, ouverts) !== undefined;
  const nonServis = resultat?.non_servis ?? [];

  return (
    <View style={styles.fond}>
      <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onRetour} accessibilityRole="button" accessibilityLabel="Retour à la liste des interventions" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={30} color={P.onHeader} />
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
            {resultat && actif ? <Text style={styles.note}>Le plan en place est affiché tout de suite ; il sera remplacé à l&apos;arrivée du nouveau calcul.</Text> : null}
          </View>
        ) : null}
        {aucunEndroit ? (
          <View style={styles.bloc} accessibilityRole="alert">
            <Text style={styles.blocTitre}>Aucun endroit à planifier</Text>
            <Text style={styles.note}>Les endroits choisis ne sont plus ouverts (réglés depuis, ou filtres trop stricts). Revenez à la liste pour changer la sélection.</Text>
            <BoutonAction titre="Retour à la liste" onPress={onRetour} />
          </View>
        ) : null}
        {raison && !calcul && !aucunEndroit ? (
          <Text style={styles.alerte} accessibilityRole="alert">
            {raison}
          </Text>
        ) : null}
        {message && !raison && !aucunEndroit ? (
          <Text style={styles.note} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        {aucunEndroit ? null : chargement && !resultat ? (
          <Chargement texte="Chargement du trajet…" />
        ) : !resultat || !actif ? (
          calcul || raison ? null : <Vide texte={MESSAGE_AUCUNE_TOURNEE} />
        ) : (
          <>
            <View style={styles.genere}>
              <MaterialCommunityIcons name="map-marker-path" size={36} color={P.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.genereTitre} maxFontSizeMultiplier={1.3}>
                  Trajet généré
                </Text>
                <Text style={styles.genereSous} maxFontSizeMultiplier={1.3}>
                  Itinéraire optimisé pour {nombre} {nombre > 1 ? "interventions" : "intervention"}
                </Text>
              </View>
              <View style={styles.duree} accessibilityLabel={`Durée estimée ${formaterDuree(actif.duree_s)}`}>
                <Ionicons name="time-outline" size={20} color={P.text} />
                <Text style={styles.dureeTexte}>{formaterDuree(actif.duree_s)}</Text>
              </View>
            </View>
            {basculeSurPrecalcule ? (
              <View style={styles.avisPrecalcule} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.avisTitre}>{MESSAGE_OPTIMISATION_PRECALCULEE}</Text>
                <Text style={styles.note}>Le vrai résultat le remplacera dès qu&apos;il arrive.</Text>
              </View>
            ) : null}
            {source === "precalcule" || basculeSurPrecalcule || (!peutGerer && etat === "repli") ? (
              <Text style={styles.note}>
                {MESSAGE_RESULTAT_PRECALCULE}
                {selectionPartielle ? `. ${MESSAGE_PRECALCULE_TOUS_ENDROITS} Il ne porte pas sur votre sélection : les chiffres de comparaison ne valent que pour le plan complet.` : ""}
              </Text>
            ) : null}

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
                      style={[styles.chip, sel && { backgroundColor: P.backgroundSelected }]}
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
                      <IllustrationProbleme categorie={i?.categorie ?? "autre"} taille={52} />
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
            {nonServis.length > 0 ? (
              <View style={styles.liste}>
                <Text style={[styles.sousTitre, { marginLeft: 6 }]} accessibilityRole="header">
                  Endroits non servis ({nonServis.length})
                </Text>
                {nonServis.map((n) => {
                  const e = endroits.find((x) => x.cle === n.cle_endroit);
                  const i = e ? interventionDe(e) : null;
                  const titre = i ? LIBELLES_CATEGORIE[i.categorie] : "Intervention";
                  const lieu = e ? lieuDeEndroit(e.position, adresses) : "";
                  return (
                    <View key={n.cle_endroit} style={styles.ligneNonServi} accessible accessibilityLabel={`${titre}, ${lieu}, importance ${LIBELLES_GRAVITE[n.gravite]}, non servi : ${n.raison}`}>
                      <IllustrationProbleme categorie={i?.categorie ?? "autre"} taille={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ligneTitre}>{titre}</Text>
                        <Text style={styles.ligneLieu} numberOfLines={2}>
                          {lieu}
                        </Text>
                        <Text style={styles.raison}>Non servi : {n.raison}</Text>
                      </View>
                      <Text style={[styles.etiquette, { backgroundColor: IMPORTANCE[n.gravite].fond, color: IMPORTANCE[n.gravite].plein }]} maxFontSizeMultiplier={1.2}>
                        {LIBELLES_GRAVITE[n.gravite]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Pressable onPress={onDetails} accessibilityRole="button" style={styles.lien}>
              <Text style={styles.lienTexte}>Options et détails du calcul (équipes, gain, incident simulé)</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {actif && peutGerer && !calcul ? (
        <View style={[styles.bas, { paddingBottom: 10 }]}>
          <BoutonAction
            titre="Suivre ce trajet"
            libelleAccessible={`Suivre le trajet de l'équipe ${actif.equipe_nom}`}
            onPress={() => router.push({ pathname: "/ville/trajet/[equipe]", params: { equipe: actif.equipe_id } })}
          />
        </View>
      ) : null}
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background },
  entete: { backgroundColor: P.header, paddingHorizontal: 18, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 14, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  retour: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  titre: { color: P.onHeader, fontSize: 28, fontWeight: "800" },
  page: { padding: 16, gap: 12, paddingBottom: 130, maxWidth: 800, width: "100%", alignSelf: "center" },
  bloc: { backgroundColor: P.surface, borderRadius: 22, padding: 16, gap: 10 },
  blocTitre: { fontSize: 17, fontWeight: "800", color: P.text },
  alerte: { fontSize: 16, color: P.danger, fontWeight: "700" },
  genere: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.bandeau, borderRadius: 22, padding: 14 },
  genereTitre: { fontSize: 22, fontWeight: "800", color: P.primary },
  genereSous: { fontSize: 14, color: P.text },
  duree: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: P.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  dureeTexte: { fontWeight: "800", fontSize: 16, color: P.text },
  note: { fontSize: 13, color: P.textSecondary },
  avisPrecalcule: { backgroundColor: FOND_AVERTISSEMENT, borderRadius: 16, padding: 12, gap: 2 },
  avisTitre: { fontSize: 14, fontWeight: "700", color: P.text },
  ligneNonServi: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  raison: { fontSize: 13, fontWeight: "600", color: P.textSecondary },
  equipes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface },
  chipTexte: { fontSize: 15, color: P.text, fontWeight: "700" },
  pastille: { width: 14, height: 14, borderRadius: 7 },
  carteCadre: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: P.border },
  sousTitre: { fontSize: 22, fontWeight: "800", color: P.text, marginTop: 4 },
  liste: { backgroundColor: P.surface, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 10 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 78 },
  colNum: { width: 40, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  trait: { position: "absolute", width: 3, top: "50%", bottom: -39 },
  num: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  numTexte: { color: BLANC_FIXE, fontWeight: "800", fontSize: 18 },
  dessin: { width: 60, height: 52, alignItems: "center", justifyContent: "center" },
  ligneTitre: { fontSize: 16, fontWeight: "800", color: P.text },
  ligneLieu: { fontSize: 13, color: P.text },
  etiquette: { fontWeight: "800", fontSize: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, overflow: "hidden" },
  lien: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  lienTexte: { color: P.primary, fontWeight: "800", textDecorationLine: "underline", fontSize: 14, textAlign: "center" },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
});
