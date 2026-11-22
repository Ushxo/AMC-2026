import React, { useState } from "react";

import { erreursInscription } from "@/lib/champs";
import { AuthButton, AuthField, AuthMessage, AuthShell } from "./AuthShell";

// Création d'un compte citoyen : prénom, nom, courriel, mot de passe (8 caractères au moins).
export default function SignupScreen({
  onSignup,
  onBack,
}: {
  onSignup: (infos: { courriel: string; motDePasse: string; prenom: string; nom: string }) => Promise<string | null>;
  onBack: () => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [essai, setEssai] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Après un premier essai, chaque champ dit quoi corriger et l'erreur disparaît dès qu'il est bon.
  const erreurs = essai ? erreursInscription({ courriel, motDePasse }) : {};

  async function valider() {
    setEssai(true);
    setMessage(null);
    if (Object.keys(erreursInscription({ courriel, motDePasse })).length > 0) return;
    setBusy(true);
    const m = await onSignup({ courriel, motDePasse, prenom: prenom.trim(), nom: nom.trim() });
    setBusy(false);
    if (m) setMessage(m);
  }

  return (
    <AuthShell title="Créer un compte" onBack={onBack}>
      <AuthField icon="person-outline" label="Prénom (facultatif)" value={prenom} onChangeText={setPrenom} autoComplete="given-name" textContentType="givenName" />
      <AuthField icon="person-outline" label="Nom (facultatif)" value={nom} onChangeText={setNom} autoComplete="family-name" textContentType="familyName" />
      <AuthField icon="mail-outline" label="Courriel" value={courriel} onChangeText={setCourriel} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" error={erreurs.courriel} />
      <AuthField icon="lock-closed-outline" label="Mot de passe (8 caractères au moins)" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry={!voir} autoCapitalize="none" textContentType="newPassword" error={erreurs.motDePasse} />
      <AuthButton label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} onPress={() => setVoir(!voir)} outline />
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      <AuthButton label="Créer mon compte" onPress={() => void valider()} busy={busy} />
    </AuthShell>
  );
}
