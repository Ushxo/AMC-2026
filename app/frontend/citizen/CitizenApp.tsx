import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import EcranCarteCitoyen from "@/components/citoyen/ecran-carte";
import { OngletsGardes } from "@/components/mouvement/onglets-gardes";
import { FeuilleProfil } from "@/components/profil/feuille-profil";
import { BOTTOM_NAV_HEIGHT, BottomNav, CitizenTab } from "../components/BottomNav";
import MyAlerts from "./MyAlerts";
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

// Application citoyen plein écran : Carte / Mes alertes avec la barre du bas. Aucune connexion n'est demandée au citoyen.
// L'icône de profil ouvre la connexion du personnel de la Ville ; un compte citoyen déjà connecté peut s'y déconnecter.
export default function CitizenApp({ compteConnecte, nom, demoHorsLigne, onLogout, onStaffLogin }: { compteConnecte: boolean; nom?: string | null; demoHorsLigne?: boolean; onLogout: () => void; onStaffLogin: () => void }) {
  const styles = useStyles(creerStyles);
  const [tab, setTab] = useState<CitizenTab>("carte");
  // La feuille « Quel problème ? » couvre tout le bas de l'écran : la barre du bas se retire pendant qu'elle est ouverte.
  const [feuille, setFeuille] = useState(false);
  const [profil, setProfil] = useState(false);

  return (
    <View style={styles.root}>
      {/* Les deux onglets restent montés une fois visités : revenir sur la carte ne recrée plus la carte native ni ses repères. */}
      <OngletsGardes
        actif={tab}
        onglets={[
          { id: "carte", gardeTaille: true, rendu: () => <EcranCarteCitoyen coquille={{ espaceBas: BOTTOM_NAV_HEIGHT, onOpenProfile: () => setProfil(true), onFeuille: setFeuille }} /> },
          { id: "alertes", rendu: () => <MyAlerts /> },
        ]}
      />
      {feuille && tab === "carte" ? null : <BottomNav active={tab} onChange={setTab} />}
      <FeuilleProfil
        visible={profil}
        onFermer={() => setProfil(false)}
        nom={compteConnecte ? (nom ?? null) : null}
        role={compteConnecte ? "Citoyen" : null}
        onConnexionPersonnel={compteConnecte ? undefined : onStaffLogin}
        onDeconnexion={compteConnecte ? onLogout : undefined}
      />
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: { flex: 1, backgroundColor: P.background },
});
