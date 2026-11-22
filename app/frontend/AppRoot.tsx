import React, { useEffect, useState } from "react";

import { Chargement } from "@/components/ville/etat-ecran";
import { useAcces } from "@/hooks/use-acces";
import AuthFlow from "./auth/AuthFlow";
import CitizenApp from "./citizen/CitizenApp";
import StaffApp from "./StaffApp";
import SupervisorApp from "./supervisor/SupervisorApp";

// Racine de l'app (« / ») : le citoyen arrive DIRECTEMENT sur la carte (aucune connexion). L'icône de profil ouvre la connexion
// du personnel de la Ville ; une session gardée d'employé ou de superviseur ouvre tout de suite son espace.
export default function AppRoot() {
  const { ecran, pret, citoyen, deconnecter } = useAcces();
  const [connexionPersonnel, setConnexionPersonnel] = useState(false);
  const logout = () => void deconnecter();

  // Une fois connecté (employé ou superviseur), la connexion se referme d'elle-même.
  useEffect(() => {
    if (ecran === "superviseur" || ecran === "employe") setConnexionPersonnel(false);
  }, [ecran]);

  if (ecran === "superviseur") return <SupervisorApp onLogout={logout} />;
  if (ecran === "employe") return <StaffApp onLogout={logout} />;
  // Reprise de la session gardée : un bref chargement évite que la carte clignote chez le personnel déjà connecté.
  if (!pret && !citoyen) return <Chargement texte="Ouverture de Priorix…" />;
  if (connexionPersonnel) return <AuthFlow onConnecte={() => setConnexionPersonnel(false)} onRetour={() => setConnexionPersonnel(false)} />;
  return <CitizenApp compteConnecte={ecran === "citoyen"} onLogout={logout} onStaffLogin={() => setConnexionPersonnel(true)} />;
}
