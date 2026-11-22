import React, { useState } from "react";

import { changerMotDePasse, envoyerCodeReinitialisation, MOT_DE_PASSE_MIN, verifierCodeReinitialisation } from "@/lib/auth";
import { erreursCourrielCompte } from "@/lib/champs";
import { AuthButton, AuthField, AuthMessage, AuthShell } from "./AuthShell";

type Etape = "courriel" | "code" | "nouveau" | "fini";

const messageDe = (e: unknown) => (e instanceof Error ? e.message : "Le service ne répond pas. Réessayez dans un instant.");

// Mot de passe oublié, en 3 étapes : courriel, code reçu par courriel, nouveau mot de passe.
export default function ResetScreen({ onBack }: { onBack: () => void }) {
  const [etape, setEtape] = useState<Etape>("courriel");
  const [courriel, setCourriel] = useState("");
  const [code, setCode] = useState("");
  const [mdp, setMdp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurChamp, setErreurChamp] = useState<string | null>(null);

  async function envoyer() {
    const e = erreursCourrielCompte(courriel);
    setErreurChamp(e.courriel ?? null);
    if (e.courriel) return;
    setBusy(true);
    setMessage(null);
    try {
      await envoyerCodeReinitialisation(courriel);
      setEtape("code");
    } catch (x) {
      setMessage(messageDe(x));
    }
    setBusy(false);
  }
  async function verifier() {
    if (code.replace(/\s/g, "").length < 4) {
      setErreurChamp("Entrez le code reçu par courriel.");
      return;
    }
    setErreurChamp(null);
    setBusy(true);
    setMessage(null);
    try {
      await verifierCodeReinitialisation(courriel, code);
      setEtape("nouveau");
    } catch (x) {
      setMessage(messageDe(x));
    }
    setBusy(false);
  }
  async function changer() {
    if (mdp.length < MOT_DE_PASSE_MIN) {
      setErreurChamp(`Le mot de passe doit avoir ${MOT_DE_PASSE_MIN} caractères au moins.`);
      return;
    }
    setErreurChamp(null);
    setBusy(true);
    setMessage(null);
    try {
      await changerMotDePasse(mdp);
      setEtape("fini");
    } catch (x) {
      setMessage(messageDe(x));
    }
    setBusy(false);
  }

  return (
    <AuthShell title="Mot de passe oublié" onBack={onBack}>
      {etape === "courriel" ? (
        <>
          <AuthMessage ok>Entrez votre courriel : si un compte existe, un code vous sera envoyé.</AuthMessage>
          <AuthField icon="mail-outline" label="Courriel" value={courriel} onChangeText={setCourriel} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={erreurChamp} />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton label="Envoyer le code" onPress={() => void envoyer()} busy={busy} />
        </>
      ) : null}
      {etape === "code" ? (
        <>
          <AuthMessage ok>Si un compte existe pour {courriel.trim()}, un code vient d’être envoyé.</AuthMessage>
          <AuthField icon="key-outline" label="Code reçu par courriel" value={code} onChangeText={setCode} keyboardType="number-pad" autoCapitalize="none" error={erreurChamp} />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton label="Vérifier le code" onPress={() => void verifier()} busy={busy} />
        </>
      ) : null}
      {etape === "nouveau" ? (
        <>
          <AuthField icon="lock-closed-outline" label={`Nouveau mot de passe (${MOT_DE_PASSE_MIN} caractères au moins)`} value={mdp} onChangeText={setMdp} secureTextEntry autoCapitalize="none" textContentType="newPassword" error={erreurChamp} />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton label="Changer le mot de passe" onPress={() => void changer()} busy={busy} />
        </>
      ) : null}
      {etape === "fini" ? (
        <>
          <AuthMessage ok>Votre mot de passe est changé.</AuthMessage>
          <AuthButton label="Retour à la connexion" onPress={onBack} />
        </>
      ) : null}
    </AuthShell>
  );
}
