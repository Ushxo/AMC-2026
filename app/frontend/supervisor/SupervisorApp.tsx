import React, { useState } from "react";
import { StyleSheet, View } from 'react-native';

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
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

type Id = "interventions" | "alertes" | "optimisation" | "equipes" | "rapports";

const ONGLETS: Onglet<Id>[] = [
  { id: "interventions", label: "Interventions", icon: "list-outline", iconActive: "list" },
  { id: "alertes", label: "Alertes", icon: "alert-circle-outline", iconActive: "alert-circle" },
  { id: "optimisation", label: "Optimisation", icon: "git-compare-outline", iconActive: "git-compare" },
  { id: "equipes", label: "Équipes", icon: "people-outline", iconActive: "people" },
  { id: "rapports", label: "Arrêts faits", icon: "checkmark-done-outline", iconActive: "checkmark-done" },
];

const ENTETES: Record<Id, { titre: string; sous: string }> = {
  interventions: { titre: "Interventions", sous: "À planifier, par importance" },
  alertes: { titre: "Alertes", sous: "Signalements reçus des citoyens" },
  optimisation: { titre: "Optimisation", sous: "Options du calcul : quoi inclure, équipes, répartition" },
  equipes: { titre: "Équipes", sous: "Départ, arrivée et compte de chaque équipe" },
  rapports: { titre: "Arrêts faits", sous: "Ce que les équipes ont réglé aujourd'hui" },
};

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
        <EnteteVert titre="Tableau de bord" sousTitre="À traiter, plan des équipes, gain du calcul" onBack={() => setTableau(false)} libelleRetour="Retour aux interventions" />
      ) : (
        <EnteteVert
          titre={ENTETES[onglet].titre}
          sousTitre={ENTETES[onglet].sous}
          droite={<BoutonProfil nom={nom} role={onAdministration ? "Administrateur" : "Superviseur"} marqueChoisie={demoHorsLigne ? "demo" : null} onAdministration={onAdministration} onDeconnexion={onLogout} />}
        />
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
  creer: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface },
  creerTexte: { color: P.primary, fontWeight: "800", fontSize: 15 },
});
