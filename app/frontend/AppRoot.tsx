import React from "react";

import { Chargement } from "@/components/ville/etat-ecran";
import { useAcces } from "@/hooks/use-acces";
import AuthFlow from "./auth/AuthFlow";
import CitizenApp from "./citizen/CitizenApp";
import StaffApp from "./StaffApp";
import SupervisorApp from "./supervisor/SupervisorApp";

// Racine de l'app (« / ») : connexion réelle (comptes, mot de passe oublié, démonstration hors ligne, ou sans compte),
// puis la coquille du rôle : citoyen (Carte, Mes alertes), superviseur (tableau de bord, alertes, optimisation, équipes,
// rapports) ou employé (Ma carte). Les écrans de chaque coquille lisent nos données réelles.
export default function AppRoot() {
  const { ecran, pret, deconnecter } = useAcces();
  const logout = () => void deconnecter();

  if (!pret && !ecran) return <Chargement texte="Ouverture de Priorix…" />;
  if (!ecran) return <AuthFlow onConnecte={() => {}} />;
  if (ecran === "citoyen") return <CitizenApp onLogout={logout} />;
  if (ecran === "superviseur") return <SupervisorApp onLogout={logout} />;
  return <StaffApp onLogout={logout} />;
}
