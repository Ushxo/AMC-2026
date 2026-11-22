import React, { useState } from "react";
import { Alert, Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAcces } from "@/hooks/use-acces";
import { EcranEquipes } from "@/app/ville/equipes";
import { EcranTournees } from "@/app/ville/tournees";
import { ListeAlertes } from "@/components/ville/liste-alertes";
import { Palette } from "@/constants/theme";
import { BarreOnglets, type Onglet } from "../components/BarreOnglets";
import { EnteteVert } from "../components/EnteteVert";
import ArretsFaits from "./ArretsFaits";
import InterventionsAPlanifier from "./InterventionsAPlanifier";
import TableauDeBord from "./TableauDeBord";
import TrajetOptimal from "./TrajetOptimal";

type Id = "interventions" | "alertes" | "optimisation" | "equipes" | "rapports";

const ONGLETS: Onglet<Id>[] = [
  { id: "interventions", label: "À planifier", icon: "list-outline", iconActive: "list" },
  { id: "alertes", label: "Alertes", icon: "alert-circle-outline", iconActive: "alert-circle" },
  { id: "optimisation", label: "Optimisation", icon: "git-compare-outline", iconActive: "git-compare" },
  { id: "equipes", label: "Équipes", icon: "people-outline", iconActive: "people" },
  { id: "rapports", label: "Rapports", icon: "checkmark-done-outline", iconActive: "checkmark-done" },
];

const ENTETES: Record<Id, { titre: string; sous: string }> = {
  interventions: { titre: "Interventions", sous: "À planifier" },
  alertes: { titre: "Alertes", sous: "Signalements reçus des citoyens" },
  optimisation: { titre: "Options du calcul", sous: "Quoi inclure, équipes, répartition du travail" },
  equipes: { titre: "Équipes", sous: "Départ, arrivée et compte de chaque équipe" },
  rapports: { titre: "Arrêts faits", sous: "Ce que les équipes ont réglé aujourd'hui" },
};

// En-tête de la page « Interventions à planifier » : casque, titre, profil (déconnexion).
function EnteteSuperviseur({ nom, onLogout, onAdministration }: { nom: string | null; onLogout: () => void; onAdministration?: () => void }) {
  const insets = useSafeAreaInsets();
  function profil() {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) onLogout();
      return;
    }
    Alert.alert(nom ? `Connecté : ${nom}` : "Mon compte", onAdministration ? "Que voulez-vous faire ?" : "Voulez-vous vous déconnecter ?", [
      ...(onAdministration ? [{ text: "Espace d'administration", onPress: onAdministration }] : []),
      { text: "Annuler", style: "cancel" as const },
      { text: "Se déconnecter", style: "destructive" as const, onPress: onLogout },
    ]);
  }
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <MaterialCommunityIcons name="hard-hat" size={44} color={Palette.onHeader} />
      <View style={{ flex: 1 }}>
        <Text style={styles.enteteTitre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Superviseur
        </Text>
        <Text style={styles.enteteSous} maxFontSizeMultiplier={1.3}>
          Tableau de bord des interventions
        </Text>
      </View>
      <Pressable onPress={profil} accessibilityRole="button" accessibilityLabel="Mon compte et déconnexion" hitSlop={8} style={styles.profil}>
        <Ionicons name="person-circle-outline" size={46} color={Palette.onHeader} />
      </Pressable>
    </View>
  );
}

// Espace superviseur : la page des interventions à planifier (avec le bouton de calcul), puis NOS écrans (alertes, optimisation, équipes, arrêts faits).
export default function SupervisorApp({ onLogout, onAdministration }: { onLogout: () => void; onAdministration?: () => void }) {
  const { nom } = useAcces();
  const [onglet, setOnglet] = useState<Id>("interventions");
  const [tableau, setTableau] = useState(false);
  // Calcul demandé depuis la liste : la sélection filtrée part avec le calcul, une seule fois par demande.
  const [demande, setDemande] = useState<{ id: number; cles: string[] } | null>(null);
  const [details, setDetails] = useState(false);

  return (
    <View style={styles.root}>
      {onglet === "optimisation" && demande && !details ? null : onglet === "interventions" && tableau ? (
        <EnteteVert titre="Tableau de bord" sousTitre="Vue d'ensemble de la journée" onBack={() => setTableau(false)} libelleRetour="Retour aux interventions" />
      ) : onglet === "interventions" && !tableau ? (
        <EnteteSuperviseur nom={nom} onLogout={onLogout} onAdministration={onAdministration} />
      ) : (
        <EnteteVert titre={ENTETES[onglet].titre} sousTitre={ENTETES[onglet].sous} />
      )}
      <View style={styles.corps}>
        {onglet === "interventions" && !tableau ? (
          <InterventionsAPlanifier
            onTableau={() => setTableau(true)}
            onCalculer={(cles) => {
              setDemande({ id: Date.now(), cles });
              setDetails(false);
              setOnglet("optimisation");
            }}
          />
        ) : null}
        {onglet === "interventions" && tableau ? <TableauDeBord /> : null}
        {onglet === "alertes" ? <ListeAlertes avecResume={false} /> : null}
        {onglet === "optimisation" && demande && !details ? (
          <TrajetOptimal
            key={demande.id}
            cles={demande.cles}
            onRetour={() => {
              setDemande(null);
              setOnglet("interventions");
            }}
            onDetails={() => setDetails(true)}
          />
        ) : null}
        {onglet === "optimisation" && (!demande || details) ? <EcranTournees key={demande?.id ?? 0} dansCoquille clesInitiales={demande?.cles} /> : null}
        {onglet === "equipes" ? (
          <>
            <EcranEquipes dansCoquille />
          </>
        ) : null}
        {onglet === "rapports" ? <ArretsFaits /> : null}
      </View>
      <BarreOnglets
        onglets={ONGLETS}
        actif={onglet}
        onChange={(id) => {
          setTableau(false);
          setDetails(false);
          if (id !== "optimisation") setDemande(null);
          setOnglet(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  corps: { flex: 1 },
  entete: { backgroundColor: Palette.header, paddingHorizontal: 20, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  enteteTitre: { color: Palette.onHeader, fontSize: 28, fontWeight: "800" },
  enteteSous: { color: "#DCDACE", fontSize: 15 },
  creer: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: Palette.borderForte, backgroundColor: Palette.surface },
  creerTexte: { color: Palette.header, fontWeight: "800", fontSize: 15 },
  profil: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
