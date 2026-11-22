import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAcces } from "@/hooks/use-acces";
import { EcranEquipes } from "@/app/ville/equipes";
import { EcranTournees } from "@/app/ville/tournees";
import { ListeAlertes } from "@/components/ville/liste-alertes";
import { Palette } from "@/constants/theme";
import { BarreOnglets, type Onglet } from "../components/BarreOnglets";
import { EnteteCoquille } from "../components/EnteteCoquille";
import ArretsFaits from "./ArretsFaits";
import TableauDeBord from "./TableauDeBord";

type Id = "tableau" | "alertes" | "optimisation" | "equipes" | "rapports";

const ONGLETS: Onglet<Id>[] = [
  { id: "tableau", label: "Tableau", icon: "grid-outline", iconActive: "grid" },
  { id: "alertes", label: "Alertes", icon: "alert-circle-outline", iconActive: "alert-circle" },
  { id: "optimisation", label: "Optimisation", icon: "git-compare-outline", iconActive: "git-compare" },
  { id: "equipes", label: "Équipes", icon: "people-outline", iconActive: "people" },
  { id: "rapports", label: "Rapports", icon: "checkmark-done-outline", iconActive: "checkmark-done" },
];

// Espace superviseur : leur coquille (en-tête, onglets), NOS écrans à l'intérieur (signalements, optimisation, équipes, arrêts faits).
export default function SupervisorApp({ onLogout }: { onLogout: () => void }) {
  const { nom } = useAcces();
  const [onglet, setOnglet] = useState<Id>("tableau");

  return (
    <View style={styles.root}>
      <EnteteCoquille sousTitre={`Superviseur · ${nom ?? ""}`} onLogout={onLogout} />
      <View style={styles.corps}>
        {onglet === "tableau" ? <TableauDeBord /> : null}
        {onglet === "alertes" ? <ListeAlertes avecResume={false} /> : null}
        {onglet === "optimisation" ? <EcranTournees dansCoquille /> : null}
        {onglet === "equipes" ? <EcranEquipes dansCoquille /> : null}
        {onglet === "rapports" ? <ArretsFaits /> : null}
      </View>
      <BarreOnglets onglets={ONGLETS} actif={onglet} onChange={setOnglet} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  corps: { flex: 1 },
});
