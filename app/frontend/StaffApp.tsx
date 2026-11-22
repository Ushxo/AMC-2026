import React from "react";
import { StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';

import { EcranTrajet } from "@/app/ville/trajet/[equipe]";
import { Palette } from "@/constants/theme";
import { Chargement } from "@/components/ville/etat-ecran";
import { useAcces } from "@/hooks/use-acces";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { useEquipes } from "@/hooks/use-equipes";
import { EnteteMaCarte } from "./components/EnteteMaCarte";

// Espace employé : une seule page, « Ma carte » = le trajet de l'équipe du compte (aperçu, navigation, « Arrêt fait », recalcul).
export default function StaffApp({ onLogout }: { onLogout: () => void }) {
  const { nom } = useAcces();
  const { equipeId, chargement } = useMonEquipe();
  const { equipes } = useEquipes();
  const nomEquipe = equipes.find((e) => e.id === equipeId)?.nom ?? null;

  return (
    <View style={styles.root}>
      <EnteteMaCarte sousTitre={nomEquipe ? `${nomEquipe} · trajet du jour` : nom ?? "Responsable d’équipe"} nom={nom} onLogout={onLogout} />
      <View style={styles.corps}>
        {chargement ? (
          <Chargement texte="Recherche de votre équipe…" />
        ) : equipeId ? (
          <EcranTrajet equipe={equipeId} />
        ) : (
          <View style={styles.vide} accessibilityRole="alert">
            <Text style={styles.titre}>Aucune équipe associée à ce compte</Text>
            <Text style={styles.texte}>Demandez au superviseur d’associer votre compte à votre équipe (fiche de l’équipe, « Compte de l’équipe »).</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  corps: { flex: 1 },
  vide: { margin: 20, padding: 20, borderRadius: 20, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, gap: 8 },
  titre: { fontSize: 18, fontWeight: "800", color: Palette.header },
  texte: { fontSize: 15, color: Palette.textSecondary },
});
