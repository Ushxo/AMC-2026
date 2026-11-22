import React, { useState } from "react";
import { StyleSheet, Text, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { useEquipes } from "@/hooks/use-equipes";
import {
  creerComptePersonnel,
  LIBELLES_ROLE_PERSONNEL,
  validerPersonnel,
  type ErreursPersonnel,
  type RolePersonnel,
} from "@/lib/compte-personnel";
import { AuthButton, AuthField, AuthMessage, AuthShell } from "../auth/AuthShell";
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

const ROLES: RolePersonnel[] = ["equipe", "superviseur", "admin"];

// Création d'un compte du personnel, réservée aux administrateurs (le serveur le vérifie aussi) :
// identité, mot de passe provisoire, rôle, et pour un employé d'équipe l'équipe à associer tout de suite (facultatif).
export default function CreerComptePersonnel({ onBack }: { onBack: () => void }) {
  const styles = useStyles(creerStyles);
  const { equipes } = useEquipes();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [role, setRole] = useState<RolePersonnel | null>(null);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [essai, setEssai] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreursServeur, setErreursServeur] = useState<ErreursPersonnel>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ texte: string; avertissement: string | null } | null>(null);

  const formulaire = { prenom, nom, courriel, motDePasse, role, equipeId: role === "equipe" ? equipeId : null };
  const erreurs: ErreursPersonnel = { ...(essai ? validerPersonnel(formulaire) : {}), ...erreursServeur };

  function vider() {
    setPrenom("");
    setNom("");
    setCourriel("");
    setMotDePasse("");
    setVoir(false);
    setRole(null);
    setEquipeId(null);
    setEssai(false);
    setErreursServeur({});
  }

  async function valider() {
    setEssai(true);
    setMessage(null);
    setConfirmation(null);
    setErreursServeur({});
    if (Object.keys(validerPersonnel(formulaire)).length > 0) return;
    setBusy(true);
    const r = await creerComptePersonnel(formulaire);
    setBusy(false);
    if (r.ok) {
      setConfirmation({ texte: `Compte créé : ${r.courriel}, rôle ${LIBELLES_ROLE_PERSONNEL[r.role]}. Communiquez-lui son mot de passe provisoire.`, avertissement: r.avertissement });
      vider(); // le mot de passe n'est pas gardé
    } else {
      setErreursServeur(r.erreurs);
      setMessage(r.message);
    }
  }

  return (
    <AuthShell title="Créer un compte du personnel" onBack={onBack}>
      {confirmation ? (
        <>
          <AuthMessage ok>{confirmation.texte}</AuthMessage>
          {confirmation.avertissement ? <AuthMessage>{confirmation.avertissement}</AuthMessage> : null}
        </>
      ) : null}
      <AuthField icon="person-outline" label="Prénom" value={prenom} onChangeText={setPrenom} autoComplete="off" error={erreurs.prenom} />
      <AuthField icon="person-outline" label="Nom" value={nom} onChangeText={setNom} autoComplete="off" error={erreurs.nom} />
      <AuthField icon="mail-outline" label="Courriel" value={courriel} onChangeText={setCourriel} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" error={erreurs.courriel} />
      <AuthField icon="lock-closed-outline" label="Mot de passe provisoire (8 caractères au moins)" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry={!voir} autoCapitalize="none" autoComplete="off" error={erreurs.motDePasse} />
      <AuthButton label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} onPress={() => setVoir(!voir)} outline />

      <Text style={styles.titre} accessibilityRole="header">
        Rôle
      </Text>
      <View style={styles.rangee}>
        {ROLES.map((r) => (
          <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: role === r }} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipActif]}>
            <Text style={styles.chipTexte}>{LIBELLES_ROLE_PERSONNEL[r]}</Text>
          </Pressable>
        ))}
      </View>
      {erreurs.role ? (
        <Text style={styles.erreur} accessibilityRole="alert">
          {erreurs.role}
        </Text>
      ) : null}

      {role === "equipe" && equipes.length > 0 ? (
        <>
          <Text style={styles.titre} accessibilityRole="header">
            Équipe à associer (facultatif)
          </Text>
          <View style={styles.rangee}>
            {equipes
              .filter((e) => e.active)
              .map((e) => (
                <Pressable key={e.id} accessibilityRole="radio" accessibilityState={{ selected: equipeId === e.id }} onPress={() => setEquipeId(equipeId === e.id ? null : e.id)} style={[styles.chip, equipeId === e.id && styles.chipActif]}>
                  <Text style={styles.chipTexte}>{e.nom}</Text>
                </Pressable>
              ))}
          </View>
        </>
      ) : null}

      {message ? <AuthMessage>{message}</AuthMessage> : null}
      <AuthButton label="Créer le compte" onPress={() => void valider()} busy={busy} />
    </AuthShell>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  titre: { fontSize: 17, fontWeight: "800", color: P.text, marginTop: 8, marginBottom: 8 },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface, justifyContent: "center" },
  chipActif: { backgroundColor: P.backgroundSelected, borderWidth: 2, borderColor: P.primary },
  chipTexte: { fontSize: 15, fontWeight: "700", color: P.text },
  erreur: { color: P.danger, fontSize: 14, marginBottom: 8 },
});
