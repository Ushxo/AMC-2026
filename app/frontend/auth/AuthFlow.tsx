import React, { useState } from "react";

import { useSessionEmploye } from "@/hooks/use-session-employe";
import { useSource } from "@/hooks/use-source";
import { creerCompteCitoyen, ouvrirSession, type EcranRole } from "@/lib/connexion";
import { definirCitoyen } from "@/lib/session";
import LoginScreen from "../citizen/LoginScreen";
import ResetScreen from "./ResetScreen";
import SignupScreen from "./SignupScreen";

// Connexion, création de compte et mot de passe oublié. Une fois connecté, `onConnecte` dit quel écran ouvrir.
export default function AuthFlow({ onConnecte }: { onConnecte: (ecran: EcranRole) => void }) {
  const [vue, setVue] = useState<"connexion" | "inscription" | "oubli">("connexion");
  const { etat } = useSource();
  const { entrerDemoHorsLigne, avertissement } = useSessionEmploye();

  if (vue === "inscription") {
    return (
      <SignupScreen
        onBack={() => setVue("connexion")}
        onSignup={async (infos) => {
          const m = await creerCompteCitoyen(infos);
          if (!m) onConnecte("citoyen");
          return m;
        }}
      />
    );
  }
  if (vue === "oubli") return <ResetScreen onBack={() => setVue("connexion")} />;
  return (
    <LoginScreen
      notice={avertissement}
      onLogin={async (email, password) => {
        const r = await ouvrirSession(email, password);
        if (r.ok) {
          onConnecte(r.ecran);
          return null;
        }
        return r.message;
      }}
      onGuest={() => {
        // Sans compte : on peut signaler et suivre ses alertes sur ce téléphone.
        definirCitoyen({ user_id: "invite", nom: "Invité", courriel: "" });
        onConnecte("citoyen");
      }}
      onSignup={() => setVue("inscription")}
      onForgot={() => setVue("oubli")}
      onDemo={
        etat === "repli"
          ? () => {
              entrerDemoHorsLigne();
              onConnecte("superviseur");
            }
          : undefined
      }
    />
  );
}
