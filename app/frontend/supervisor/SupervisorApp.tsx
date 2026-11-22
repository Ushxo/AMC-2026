import React, { useState } from "react";
import { StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAcces } from "@/hooks/use-acces";
import { EcranEquipes } from "@/app/ville/equipes";
import { EcranTournees } from "@/app/ville/tournees";
import { ListeAlertes } from "@/components/ville/liste-alertes";
import { BarreOnglets, type Onglet } from "../components/BarreOnglets";
import { BoutonProfil } from "../components/BoutonProfil";
import { EnteteVert } from "../components/EnteteVert";
import ArretsFaits from "./ArretsFaits";
import InterventionsAPlanifier from "./InterventionsAPlanifier";
import TableauDeBord from "./TableauDeBord";
import TrajetOptimal from "./TrajetOptimal";
import { LogoMarque } from "@/components/logo-marque";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

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
function EnteteSuperviseur({ nom, onLogout, onAdministration, demoHorsLigne }: { nom: string | null; onLogout: () => void; onAdministration?: () => void; demoHorsLigne?: boolean }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.entete, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <LogoMarque taille={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.enteteTitre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Superviseur
        </Text>
        <Text style={styles.enteteSous} maxFontSizeMultiplier={1.3}>
          Tableau de bord des interventions
        </Text>
      </View>
      <BoutonProfil nom={nom} role={onAdministration ? "Administrateur" : "Superviseur"} marqueChoisie={demoHorsLigne ? "demo" : null} onAdministration={onAdministration} onDeconnexion={onLogout} />
    </View>
  );
}

// Espace superviseur : la page des interventions à planifier (avec le bouton de calcul), puis NOS écrans (alertes, optimisation, équipes, arrêts faits).
export default function SupervisorApp({ onLogout, onAdministration }: { onLogout: () => void; onAdministration?: () => void }) {
  const styles = useStyles(creerStyles);
  const { nom, demoHorsLigne } = useAcces();
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
        <EnteteSuperviseur nom={nom} onLogout={onLogout} onAdministration={onAdministration} demoHorsLigne={demoHorsLigne} />
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

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: { flex: 1, backgroundColor: P.background },
  corps: { flex: 1 },
  entete: { backgroundColor: P.header, paddingHorizontal: 20, paddingBottom: 22, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  enteteTitre: { color: P.onHeader, fontSize: 28, fontWeight: "800" },
  enteteSous: { color: P.onHeaderSoft, fontSize: 15 },
  creer: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface },
  creerTexte: { color: P.primary, fontWeight: "800", fontSize: 15 },
});
