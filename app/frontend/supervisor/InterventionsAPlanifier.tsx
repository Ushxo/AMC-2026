import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { VOILE_FEUILLE, FEUILLE_BASE, COULEUR_OMBRE, COULEURS_IMPORTANCE, COULEURS_IMPORTANCE_SOMBRE, BLANC_FIXE } from '@/components/ville/style';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { ChiffreGlissant } from "@/components/mouvement/chiffre-glissant";
import { ModaleAnimee } from "@/components/mouvement/modale-animee";
import { hrefEndroit } from "@/components/ville/href-endroit";
import { Chargement, Erreur, Vide } from "@/components/ville/etat-ecran";
import { useEndroits } from "@/hooks/use-endroits";
import { useZonesSignalements } from "@/hooks/use-zones-signalements";
import { formaterDate, formaterNombre } from "@/lib/format";
import { chargerAdresses } from "@/lib/officiel";
import { AUCUN_FILTRE, clesDesInterventions, filtreCalculable, FILTRES_ETAT, interventionsAPlanifier, lieuDeEndroit, LIBELLES_FILTRE_ETAT, TITRES_FILTRE_ETAT, type FiltreEtat, type FiltresInterventions, type Intervention } from "@/lib/interventions";
import { clesDeZone } from "@/lib/selection";
import { CATEGORIES_PROPOSEES, LIBELLES_CATEGORIE, LIBELLES_ETAT, LIBELLES_GRAVITE, type Gravite } from "@/types";
import { IllustrationProbleme } from "@/components/illustration-probleme";
import { ajusterContraste } from '@/marque/couleurs';
import { useMarque, useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

// Couleurs d'importance de la maquette : rouge, orange, jaune. Le texte et la pastille pleine restent contrastés.
type Importance = { fond: string; plein: string; accent: string; icone: keyof typeof Ionicons.glyphMap };
const ICONES_IMPORTANCE: Record<Gravite, keyof typeof Ionicons.glyphMap> = { elevee: "chevron-up", moyenne: "remove", faible: "chevron-down" };
function importances(sombre: boolean): Record<Gravite, Importance> {
  const c = sombre ? COULEURS_IMPORTANCE_SOMBRE : null;
  const t = (g: Gravite): Importance => ({ fond: (c ?? COULEURS_IMPORTANCE)[g].fond, plein: COULEURS_IMPORTANCE[g].plein, accent: c ? c[g].accent : ajusterContraste(COULEURS_IMPORTANCE[g].plein, COULEURS_IMPORTANCE[g].fond, 4.5), icone: ICONES_IMPORTANCE[g] });
  return { elevee: t("elevee"), moyenne: t("moyenne"), faible: t("faible") };
}
const IMPORTANCE_CLAIR = importances(false);
const IMPORTANCE_SOMBRE = importances(true);
/** Couleurs d'importance selon le thème (thème sombre : fonds foncés, textes éclaircis). */
export function useImportance(): Record<Gravite, Importance> {
  return useMarque().sombre ? IMPORTANCE_SOMBRE : IMPORTANCE_CLAIR;
}

type Choix = { valeur: string | null; libelle: string };

function ListeDeroulante({ icone, titre, choix, valeur, onChoisir, sansTous = false, valeurParDefaut = null }: { icone: keyof typeof Ionicons.glyphMap; titre: string; choix: Choix[]; valeur: string | null; onChoisir: (v: string | null) => void; /** Pas de choix « Tous » (le filtre a toujours une valeur). */ sansTous?: boolean; /** Valeur sans effet de filtre : la pastille n'est « active » que si on en choisit une autre. */ valeurParDefaut?: string | null }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const courant = choix.find((c) => c.valeur === valeur);
  const actif = valeur !== valeurParDefaut;
  const afficheChoix = actif || sansTous;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titre} : ${afficheChoix ? courant?.libelle : "tous"}. Changer.`}
        onPress={() => setOuvert(true)}
        style={[styles.pilule, actif && styles.piluleActive]}
      >
        <Ionicons name={icone} size={20} color={P.text} />
        <Text style={styles.piluleTexte} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {afficheChoix ? courant?.libelle : titre}
        </Text>
        <Ionicons name="chevron-down" size={18} color={P.text} />
      </Pressable>
      <ModaleAnimee visible={ouvert} onFermer={() => setOuvert(false)} libelleFermer="Fermer la liste">
        <View style={styles.feuille}>
          <Text style={styles.feuilleTitre} accessibilityRole="header">
            {titre}
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {(sansTous ? choix : [{ valeur: null, libelle: "Tous" }, ...choix]).map((c) => (
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
                {c.valeur === valeur ? <Ionicons name="checkmark" size={22} color={P.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ModaleAnimee>
    </>
  );
}

function Ligne({ i, lieu, onOuvrir }: { i: Intervention; lieu: string; onOuvrir: () => void }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const c = useImportance()[i.gravite];
  const grandTexte = useWindowDimensions().fontScale > 1.3; // texte très agrandi : on libère la place du dessin
  const titre = LIBELLES_CATEGORIE[i.categorie];
  // Le nombre de signalements (quand il y en a plusieurs) et l'état (quand il n'est pas « nouveau ») : rien de l'ancienne liste d'alertes ne se perd.
  const suite = [i.nombre && i.nombre > 1 ? `${i.nombre} signalements` : null, i.etat && i.etat !== "nouveau" ? LIBELLES_ETAT[i.etat] : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onOuvrir}
      accessibilityRole="button"
      accessibilityLabel={`Importance ${LIBELLES_GRAVITE[i.gravite]}, ${titre}, ${lieu}${suite ? `, ${suite}` : ""}. Ouvrir la fiche.`}
      style={styles.ligne}
    >
      <View style={[styles.priorite, { backgroundColor: c.fond }]}>
        <Ionicons name={c.icone} size={26} color={c.accent} />
        <Text style={[styles.prioriteTexte, { backgroundColor: c.plein }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
          {LIBELLES_GRAVITE[i.gravite]}
        </Text>
      </View>
      {grandTexte ? null : (
        <View style={styles.dessin}>
          <IllustrationProbleme categorie={i.categorie} taille={48} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.ligneTitre} maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>
        <View style={styles.detail}>
          <Ionicons name="location-outline" size={15} color={P.text} />
          <Text style={styles.detailTexte} numberOfLines={2}>
            {lieu}
          </Text>
        </View>
        <Text style={styles.detailTexte}>Signalée le {formaterDate(i.signaleeLe).split(',')[0]}</Text>
        {suite ? <Text style={[styles.detailTexte, styles.detailSuite]}>{suite}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={22} color={P.text} />
    </Pressable>
  );
}

/** Page « Interventions à planifier » : liste filtrée des endroits ouverts, et le bouton qui lance notre optimisation sur cette liste. */
export default function InterventionsAPlanifier({ onCalculer, onTableau }: { onCalculer: (cles: string[]) => void; onTableau: () => void }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const router = useRouter();
  const { endroits, signalements, chargement, erreur, rafraichir } = useEndroits();
  const [actualisation, setActualisation] = useState(false);
  const zones = useZonesSignalements(signalements);
  const adresses = useMemo(() => chargerAdresses(), []);
  const [filtres, setFiltres] = useState<FiltresInterventions>(AUCUN_FILTRE);
  const liste = useMemo(() => interventionsAPlanifier(endroits, zones, filtres), [endroits, zones, filtres]);
  const secteurs: Choix[] = zones
    .map((z, n) => ({ valeur: z.id, libelle: `Zone ${n + 1} (${formaterNombre(clesDeZone(z, endroits).length, "endroit", "endroits")})` }))
    .filter((c) => !c.libelle.includes("(0 "));
  const lieu = (i: Intervention) => lieuDeEndroit(i.endroit.position, adresses);
  const calculable = filtreCalculable(filtres.etat);
  async function actualiser() {
    setActualisation(true);
    await rafraichir();
    setActualisation(false);
  }

  return (
    <View style={styles.fond}>
      <FlatList
        testID="liste-interventions"
        data={chargement || erreur ? [] : liste}
        keyExtractor={(i) => i.endroit.cle}
        renderItem={({ item }) => <Ligne i={item} lieu={lieu(item)} onOuvrir={() => router.push(hrefEndroit(item.endroit))} />}
        contentContainerStyle={[styles.page, { paddingBottom: 16 }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        initialNumToRender={10}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void actualiser()} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={styles.titreRangee}>
              <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
                {TITRES_FILTRE_ETAT[filtres.etat]}
              </Text>
              <View style={styles.compteurCadre} accessibilityLabel={filtres.etat === "a_traiter" ? `${liste.length} à traiter` : formaterNombre(liste.length, "endroit", "endroits")}>
                <ChiffreGlissant valeur={filtres.etat === "a_traiter" ? `${liste.length} à traiter` : formaterNombre(liste.length, "endroit", "endroits")} style={styles.compteur} />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtres} accessibilityLabel="Filtres">
 <ListeDeroulante
                icone="flag-outline"
                titre="État"
                sansTous
                valeurParDefaut="a_traiter"
                choix={FILTRES_ETAT.map((e) => ({ valeur: e, libelle: LIBELLES_FILTRE_ETAT[e] }))}
                valeur={filtres.etat}
                onChoisir={(v) => setFiltres({ ...filtres, etat: (v ?? "a_traiter") as FiltreEtat })}
              />
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
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          chargement ? (
            <Chargement texte="Chargement des interventions…" />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : (
            <Vide texte={filtres.etat === "a_traiter" ? "Aucune intervention à planifier avec ces filtres." : "Aucun endroit ne correspond à ces filtres."} />
          )
        }
        ListFooterComponent={
          <Pressable onPress={onTableau} accessibilityRole="button" style={styles.lien}>
            <Text style={styles.lienTexte}>Voir le tableau de bord complet</Text>
          </Pressable>
        }
      />

      <View style={styles.bas}>
        {!calculable ? (
          <Text style={styles.explication} accessibilityRole="alert">
            Le calcul ne porte que sur des endroits à traiter : choisissez « À traiter » dans le filtre « État ».
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: liste.length === 0 || !calculable }}
          accessibilityLabel={`Calculer le trajet optimal pour ${liste.length} interventions`}
          disabled={liste.length === 0 || !calculable}
          onPress={() => onCalculer(clesDesInterventions(liste))}
          style={[styles.calculer, (liste.length === 0 || !calculable) && { opacity: 0.5 }]}
        >
          <Ionicons name="navigate-outline" size={28} color={P.surface} />
          <View style={{ flex: 1 }}>
            <Text style={styles.calculerTitre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
              Calculer le trajet optimal
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={24} color={P.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background },
  page: { padding: 20, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
  titreRangee: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  titre: { fontSize: 22, fontWeight: "800", color: P.text, flexShrink: 1 },
  compteurCadre: { backgroundColor: P.backgroundSelected, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: "hidden" },
  compteur: { color: P.primary, fontWeight: "800", fontSize: 16, lineHeight: 22 },
  sous: { color: P.textSecondary, fontSize: 15 },
  filtresTitre: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  filtresMot: { fontSize: 20, fontWeight: "800", color: P.text },
  filtres: { flexDirection: "row", gap: 8, paddingRight: 8 },
  pilule: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface },
  piluleActive: { backgroundColor: P.backgroundSelected },
  piluleTexte: { color: P.text, fontSize: 15, flexShrink: 1 },
  voile: { flex: 1, backgroundColor: VOILE_FEUILLE },
  feuille: { backgroundColor: P.background, ...FEUILLE_BASE, padding: 20, gap: 8 },
  feuilleTitre: { fontSize: 20, fontWeight: "800", color: P.text },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: P.border },
  optionTexte: { fontSize: 17, color: P.text },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.surface, borderRadius: 22, padding: 12, shadowColor: COULEUR_OMBRE, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  priorite: { minWidth: 68, borderRadius: 16, alignItems: "center", paddingTop: 8, paddingBottom: 8, gap: 4 },
  prioriteTexte: { color: BLANC_FIXE, fontWeight: "800", fontSize: 13, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, overflow: "hidden" },
  dessin: { width: 52, height: 48, alignItems: "center", justifyContent: "center" },
  ligneTitre: { fontSize: 17, fontWeight: "800", color: P.text },
  detail: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  detailTexte: { fontSize: 13, color: P.text, flexShrink: 1 },
  detailSuite: { fontWeight: "700", color: P.primary },
  explication: { fontSize: 13, lineHeight: 18, color: P.textSecondary, paddingBottom: 8 },
  lien: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  lienTexte: { color: P.primary, fontWeight: "800", textDecorationLine: "underline", fontSize: 15 },
  bas: { backgroundColor: P.background, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  calculer: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.action, borderRadius: 30, paddingHorizontal: 24, paddingVertical: 8, minHeight: 56 },
  calculerTitre: { color: P.surface, fontSize: 18, fontWeight: "800" },
  calculerSous: { color: P.surface, fontSize: 14, marginTop: 2 },
});
