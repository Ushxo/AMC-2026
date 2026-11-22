import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { EcranEquipes } from "@/app/ville/equipes";
import { Palette } from "@/constants/theme";
import { useAcces } from "@/hooks/use-acces";
import { BarreOnglets, type Onglet } from "../components/BarreOnglets";
import { EnteteVert } from "../components/EnteteVert";
import SupervisorApp from "../supervisor/SupervisorApp";
import ComptesPersonnel from "./ComptesPersonnel";
import CreerComptePersonnel from "./CreerComptePersonnel";
import MarqueOrganisation from "./MarqueOrganisation";

type Id = "comptes" | "marque" | "equipes" | "superviseur";

const ONGLETS: Onglet<Id>[] = [
  { id: "comptes", label: "Comptes", icon: "people-circle-outline", iconActive: "people-circle" },
  { id: "marque", label: "Marque", icon: "color-palette-outline", iconActive: "color-palette" },
  { id: "equipes", label: "Équipes", icon: "people-outline", iconActive: "people" },
  { id: "superviseur", label: "Superviseur", icon: "clipboard-outline", iconActive: "clipboard" },
];

const ENTETES: Record<Exclude<Id, "superviseur">, { titre: string; sous: string }> = {
  comptes: { titre: "Administration", sous: "Comptes du personnel" },
  marque: { titre: "Administration", sous: "Organisations et marque" },
  equipes: { titre: "Administration", sous: "Équipes de la Ville" },
};

// Espace d'administration, ouvert à la connexion d'un administrateur : comptes, marque des organisations, équipes,
// et l'espace Superviseur (un administrateur garde tout ce que voit un superviseur).
export default function AdminApp({ onLogout }: { onLogout: () => void }) {
  const { nom } = useAcces();
  const [onglet, setOnglet] = useState<Id>("comptes");
  const [creation, setCreation] = useState(false);

  function profil() {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) onLogout();
      return;
    }
    Alert.alert(nom ? `Connecté : ${nom}` : "Mon compte", "Administrateur", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: onLogout },
    ]);
  }

  if (onglet === "superviseur") return <SupervisorApp onLogout={onLogout} onAdministration={() => setOnglet("comptes")} />;
  if (creation) return <CreerComptePersonnel onBack={() => setCreation(false)} />;

  const e = ENTETES[onglet];
  return (
    <View style={styles.root}>
      <EnteteVert
        titre={e.titre}
        sousTitre={e.sous}
        droite={
          <Pressable onPress={profil} accessibilityRole="button" accessibilityLabel="Mon compte et déconnexion" hitSlop={8} style={styles.profil}>
            <Ionicons name="person-circle-outline" size={46} color={Palette.onHeader} />
          </Pressable>
        }
      />
      <View style={styles.corps}>
        {onglet === "comptes" ? <ComptesPersonnel onCreer={() => setCreation(true)} /> : null}
        {onglet === "marque" ? <MarqueOrganisation /> : null}
        {onglet === "equipes" ? <EcranEquipes dansCoquille /> : null}
      </View>
      <BarreOnglets onglets={ONGLETS} actif={onglet} onChange={setOnglet} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  corps: { flex: 1 },
  profil: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
