import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";

import { Palette } from "@/constants/theme";
import { hrefEndroit } from "@/components/ville/href-endroit";
import { Chargement, Erreur, Vide } from "@/components/ville/etat-ecran";
import { useEndroits } from "@/hooks/use-endroits";
import { useZonesSignalements } from "@/hooks/use-zones-signalements";
import { formaterDate, formaterNombre } from "@/lib/format";
import { chargerAdresses } from "@/lib/officiel";
import { AUCUN_FILTRE, clesDesInterventions, interventionsAPlanifier, lieuDeEndroit, type FiltresInterventions, type Intervention } from "@/lib/interventions";
import { clesDeZone } from "@/lib/selection";
import { CATEGORIES_PROPOSEES, LIBELLES_CATEGORIE, LIBELLES_GRAVITE, type Gravite } from "@/types";
import { ILLUSTRATION_PAR_CATEGORIE, ProblemIllustration } from "../components/ProblemIllustration";

// Couleurs d'importance de la maquette : rouge, orange, jaune. Le texte et la pastille pleine restent contrastés.
export const IMPORTANCE: Record<Gravite, { fond: string; plein: string; icone: keyof typeof Ionicons.glyphMap }> = {
  elevee: { fond: "#F8D9D4", plein: "#B3261E", icone: "chevron-up" },
  moyenne: { fond: "#FCE3CF", plein: "#B84A0B", icone: "remove" },
  faible: { fond: "#FAF0C4", plein: "#8A6200", icone: "chevron-down" },
};

type Choix = { valeur: string | null; libelle: string };

function ListeDeroulante({ icone, titre, choix, valeur, onChoisir }: { icone: keyof typeof Ionicons.glyphMap; titre: string; choix: Choix[]; valeur: string | null; onChoisir: (v: string | null) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const courant = choix.find((c) => c.valeur === valeur);
  const actif = valeur !== null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titre} : ${actif ? courant?.libelle : "tous"}. Changer.`}
        onPress={() => setOuvert(true)}
        style={[styles.pilule, actif && styles.piluleActive]}
      >
        <Ionicons name={icone} size={20} color={Palette.text} />
        <Text style={styles.piluleTexte} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {actif ? courant?.libelle : titre}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Palette.text} />
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.voile} onPress={() => setOuvert(false)} accessibilityRole="button" accessibilityLabel="Fermer la liste" />
        <View style={styles.feuille}>
          <Text style={styles.feuilleTitre} accessibilityRole="header">
            {titre}
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {[{ valeur: null, libelle: "Tous" }, ...choix].map((c) => (
              <Pressable
                key={c.valeur ?? "tous"}
                accessibilityRole="radio"
                accessibilityState={{ selected: c.valeur === valeur }}
                onPress={() => {
                  onChoisir(c.valeur);
                  setOuvert(false);
                }}
                style={styles.option}
              >
                <Text style={[styles.optionTexte, c.valeur === valeur && { fontWeight: "800" }]}>{c.libelle}</Text>
                {c.valeur === valeur ? <Ionicons name="checkmark" size={22} color={Palette.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Ligne({ i, lieu, onOuvrir }: { i: Intervention; lieu: string; onOuvrir: () => void }) {
  const c = IMPORTANCE[i.gravite];
  const kind = ILLUSTRATION_PAR_CATEGORIE[i.categorie];
  const titre = LIBELLES_CATEGORIE[i.categorie];
  return (
    <Pressable
      onPress={onOuvrir}
      accessibilityRole="button"
      accessibilityLabel={`Importance ${LIBELLES_GRAVITE[i.gravite]}, ${titre}, ${lieu}. Ouvrir la fiche.`}
      style={styles.ligne}
    >
      <View style={[styles.priorite, { backgroundColor: c.fond }]}>
        <Ionicons name={c.icone} size={26} color={c.plein} />
        <Text style={[styles.prioriteTexte, { backgroundColor: c.plein }]} maxFontSizeMultiplier={1.2}>
          {LIBELLES_GRAVITE[i.gravite]}
        </Text>
      </View>
      <View style={styles.dessin}>
        {kind ? (
          <View style={{ transform: [{ scale: 0.5 }] }}>
            <ProblemIllustration kind={kind} />
          </View>
        ) : (
          <Ionicons name="warning-outline" size={30} color={Palette.accent} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ligneTitre} maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>
        <View style={styles.detail}>
          <Ionicons name="location-outline" size={15} color={Palette.text} />
          <Text style={styles.detailTexte} numberOfLines={2}>
            {lieu}
          </Text>
        </View>
        <Text style={styles.detailTexte}>Signalée le {formaterDate(i.signaleeLe)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={Palette.text} />
    </Pressable>
  );
}

/** Page « Interventions à planifier » : liste filtrée des endroits ouverts, et le bouton qui lance notre optimisation sur cette liste. */
export default function InterventionsAPlanifier({ onCalculer, onTableau }: { onCalculer: (cles: string[]) => void; onTableau: () => void }) {
  const router = useRouter();
  const { endroits, signalements, chargement, erreur, rafraichir } = useEndroits();
  const zones = useZonesSignalements(signalements);
  const adresses = useMemo(() => chargerAdresses(), []);
  const [filtres, setFiltres] = useState<FiltresInterventions>(AUCUN_FILTRE);
  const liste = useMemo(() => interventionsAPlanifier(endroits, zones, filtres), [endroits, zones, filtres]);
  const secteurs: Choix[] = zones
    .map((z, n) => ({ valeur: z.id, libelle: `Zone ${n + 1} (${formaterNombre(clesDeZone(z, endroits).length, "endroit", "endroits")})` }))
    .filter((c) => !c.libelle.includes("(0 "));
  const lieu = (i: Intervention) => lieuDeEndroit(i.endroit.position, adresses);

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 130 }]}>
        <View style={styles.titreRangee}>
          <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            Interventions à planifier
          </Text>
          <Text style={styles.compteur} accessibilityLabel={`${liste.length} à traiter`}>
            {liste.length} à traiter
          </Text>
        </View>
        <Text style={styles.sous}>Priorisées par degré d’importance pour l’optimisation du trajet.</Text>

        <View style={styles.filtresTitre}>
          <Ionicons name="funnel-outline" size={22} color={Palette.text} />
          <Text style={styles.filtresMot} accessibilityRole="header">
            Filtres
          </Text>
        </View>
        <View style={styles.filtres}>
          <ListeDeroulante icone="location-outline" titre="Secteur" choix={secteurs} valeur={filtres.zoneId} onChoisir={(v) => setFiltres({ ...filtres, zoneId: v })} />
          <ListeDeroulante
            icone="warning-outline"
            titre="Type de problème"
            choix={CATEGORIES_PROPOSEES.map((c) => ({ valeur: c, libelle: LIBELLES_CATEGORIE[c] }))}
            valeur={filtres.categorie}
            onChoisir={(v) => setFiltres({ ...filtres, categorie: v as FiltresInterventions["categorie"] })}
          />
          <ListeDeroulante
            icone="list-outline"
            titre="Importance"
            choix={(["elevee", "moyenne", "faible"] as Gravite[]).map((g) => ({ valeur: g, libelle: LIBELLES_GRAVITE[g] }))}
            valeur={filtres.gravite}
            onChoisir={(v) => setFiltres({ ...filtres, gravite: v as Gravite | null })}
          />
        </View>

        {chargement ? (
          <Chargement texte="Chargement des interventions…" />
        ) : erreur ? (
          <Erreur message={erreur} onReessayer={() => void rafraichir()} />
        ) : liste.length === 0 ? (
          <Vide texte="Aucune intervention à planifier avec ces filtres." />
        ) : (
          liste.map((i) => <Ligne key={i.endroit.cle} i={i} lieu={lieu(i)} onOuvrir={() => router.push(hrefEndroit(i.endroit))} />)
        )}
        <Pressable onPress={onTableau} accessibilityRole="button" style={styles.lien}>
          <Text style={styles.lienTexte}>Voir le tableau de bord complet</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bas} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: liste.length === 0 }}
          accessibilityLabel={`Calculer le trajet optimal pour ${liste.length} interventions`}
          disabled={liste.length === 0}
          onPress={() => onCalculer(clesDesInterventions(liste))}
          style={[styles.calculer, liste.length === 0 && { opacity: 0.5 }]}
        >
          <MaterialCommunityIcons name="map-marker-path" size={34} color={Palette.surface} />
          <View style={styles.separateur} />
          <View style={{ flex: 1 }}>
            <Text style={styles.calculerTitre} maxFontSizeMultiplier={1.2}>
              Calculer le trajet optimal
            </Text>
            <Text style={styles.calculerSous} maxFontSizeMultiplier={1.2}>
              Générer le chemin optimisé pour ces interventions
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={28} color={Palette.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: Palette.background },
  page: { padding: 18, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
  titreRangee: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  titre: { fontSize: 26, fontWeight: "800", color: Palette.text, flexShrink: 1 },
  compteur: { backgroundColor: "#F3E7C3", color: Palette.header, fontWeight: "800", fontSize: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, overflow: "hidden" },
  sous: { color: Palette.textSecondary, fontSize: 15 },
  filtresTitre: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  filtresMot: { fontSize: 20, fontWeight: "800", color: Palette.text },
  filtres: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pilule: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: Palette.borderForte, backgroundColor: Palette.surface, flexShrink: 1 },
  piluleActive: { backgroundColor: Palette.backgroundSelected },
  piluleTexte: { color: Palette.text, fontSize: 15, flexShrink: 1 },
  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  feuille: { backgroundColor: Palette.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 8 },
  feuilleTitre: { fontSize: 20, fontWeight: "800", color: Palette.text },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: Palette.border },
  optionTexte: { fontSize: 17, color: Palette.text },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Palette.surface, borderRadius: 24, padding: 10, shadowColor: "#1A261A", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  priorite: { width: 76, borderRadius: 18, alignItems: "center", paddingTop: 8, paddingBottom: 6, gap: 4 },
  prioriteTexte: { color: "#FFFFFF", fontWeight: "800", fontSize: 13, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  dessin: { width: 60, height: 52, alignItems: "center", justifyContent: "center" },
  ligneTitre: { fontSize: 17, fontWeight: "800", color: Palette.text },
  detail: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  detailTexte: { fontSize: 13, color: Palette.text, flexShrink: 1 },
  lien: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  lienTexte: { color: Palette.header, fontWeight: "800", textDecorationLine: "underline", fontSize: 15 },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  calculer: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#B84A0B", borderRadius: 32, paddingHorizontal: 22, paddingVertical: 16, minHeight: 80 },
  separateur: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.5)" },
  calculerTitre: { color: Palette.surface, fontSize: 20, fontWeight: "800" },
  calculerSous: { color: Palette.surface, fontSize: 14, marginTop: 2 },
});
