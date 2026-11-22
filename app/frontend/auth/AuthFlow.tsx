import React, { useState } from "react";

import { useSessionEmploye } from "@/hooks/use-session-employe";
import { useSource } from "@/hooks/use-source";
import { ouvrirSession, type EcranRole } from "@/lib/connexion";
import LoginScreen from "../citizen/LoginScreen";
import ResetScreen from "./ResetScreen";

// Connexion du personnel de la Ville (employé, superviseur, admin) et mot de passe oublié. Un compte citoyen existant s'y connecte
// aussi sans erreur. La création de compte n'est pas proposée (le code d'inscription reste dans SignupScreen).
export default function AuthFlow({ onConnecte, onRetour }: { onConnecte: (ecran: EcranRole) => void; onRetour?: () => void }) {
  const [vue, setVue] = useState<"connexion" | "oubli">("connexion");
  const { etat } = useSource();
  const { entrerDemoHorsLigne, avertissement } = useSessionEmploye();

  if (vue === "oubli") return <ResetScreen onBack={() => setVue("connexion")} />;
  return (
    <LoginScreen
      notice={avertissement}
      onBack={onRetour}
      onLogin={async (email, password) => {
        const r = await ouvrirSession(email, password);
        if (r.ok) {
          onConnecte(r.ecran);
          return null;
        }
        return r.message;
      }}
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
