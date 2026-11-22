import React from "react";

import { useAcces } from "@/hooks/use-acces";
import AuthFlow from "./auth/AuthFlow";
import CitizenApp from "./citizen/CitizenApp";
import { DemoProvider } from "./context/DemoContext";
import StaffApp from "./StaffApp";
import SupervisorApp from "./supervisor/SupervisorApp";

// Point d'entrée : connexion réelle (comptes, mot de passe oublié, démonstration hors ligne), puis la coquille du rôle.
// Le contenu des coquilles passe des données de maquette (DemoProvider) à nos données réelles palier par palier.
export default function AppRoot() {
  const { ecran, nom, deconnecter } = useAcces();
  const logout = () => void deconnecter();

  return (
    <DemoProvider>
      {!ecran ? (
        <AuthFlow onConnecte={() => {}} />
      ) : ecran === "citoyen" ? (
        <CitizenApp onLogout={logout} />
      ) : ecran === "superviseur" ? (
        <SupervisorApp onLogout={logout} />
      ) : (
        <StaffApp session={{ email: nom ?? "", role: "employe" }} onLogout={logout} />
      )}
    </DemoProvider>
  );
}
