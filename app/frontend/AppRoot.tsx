import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";


import { definirPolicesChargees } from "@/components/texte";
import { abonnerOrganisations, lireMonOrganisation, lireOrganisations } from "@/lib/organisations";
import { appliquerMarquePersonnel, chargerMarqueLocale, mettreAJourOrganisation, restaurerMarqueCitoyen } from "@/marque/magasin";
import { BarreEtat } from "@/marque/barre-etat";
import { useMarque } from "@/marque/utiliser";
import { Chargement } from "@/components/ville/etat-ecran";
import { useAcces } from "@/hooks/use-acces";
import AuthFlow from "./auth/AuthFlow";
import CitizenApp from "./citizen/CitizenApp";
import EmployeeApp from "./employee/EmployeeApp";
import SupervisorApp from "./supervisor/SupervisorApp";
import AdminApp from "./admin/AdminApp";

// Racine de l'app (« / ») : le citoyen arrive DIRECTEMENT sur la carte (aucune connexion). L'icône de profil ouvre la connexion
// du personnel de la Ville ; une session gardée d'employé ou de superviseur ouvre tout de suite son espace.
export default function AppRoot() {
  return (
    <>
      <BarreEtat />
      <ContenuRacine />
    </>
  );
}

function ContenuRacine() {
  // Polices de l'interface : l'écran attend leur chargement ; si le chargement échoue, tout reste en police du système.
  const [polices, erreurPolices] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  definirPolicesChargees(polices && !erreurPolices);
  const { ecran, pret, citoyen, nom, demoHorsLigne, deconnecter } = useAcces();
  const { organisation } = useMarque();
  const [connexionPersonnel, setConnexionPersonnel] = useState(false);
  const logout = () => void deconnecter();

  // La marque : relue au démarrage (choix du citoyen, apparence), rafraîchie depuis la base et suivie en direct (Realtime).
  useEffect(() => {
    void chargerMarqueLocale();
    const rafraichir = () =>
      void lireOrganisations().then((r) => {
        if (r.enBase) r.organisations.forEach(mettreAJourOrganisation);
      });
    rafraichir();
    return abonnerOrganisations(rafraichir);
  }, []);

  // Après la connexion d'un compte du personnel : son organisation (mon_organisation) donne la marque de toute l'app ;
  // à la déconnexion, la marque du citoyen revient. Sans la fonction (migration pas lancée) la marque courante reste.
  const personnel = ecran === "superviseur" || ecran === "employe" || ecran === "admin";
  useEffect(() => {
    if (!personnel) {
      restaurerMarqueCitoyen();
      return;
    }
    let actif = true;
    void lireMonOrganisation().then((o) => {
      if (actif && o) appliquerMarquePersonnel(o);
    });
    return () => {
      actif = false;
    };
  }, [personnel]);

  // Une fois connecté (employé ou superviseur), la connexion se referme d'elle-même.
  useEffect(() => {
    if (ecran === "superviseur" || ecran === "employe" || ecran === "admin") setConnexionPersonnel(false);
  }, [ecran]);

  if (!polices && !erreurPolices) return <Chargement texte={`Ouverture de ${organisation.nom_app}…`} />;
  if (ecran === "admin") return <AdminApp onLogout={logout} />;
  if (ecran === "superviseur") return <SupervisorApp onLogout={logout} />;
  if (ecran === "employe") return <EmployeeApp onLogout={logout} />;
  // Reprise de la session gardée : un bref chargement évite que la carte clignote chez le personnel déjà connecté.
  if (!pret && !citoyen) return <Chargement texte={`Ouverture de ${organisation.nom_app}…`} />;
  if (connexionPersonnel) return <AuthFlow onConnecte={() => setConnexionPersonnel(false)} onRetour={() => setConnexionPersonnel(false)} />;
  return <CitizenApp compteConnecte={ecran === "citoyen"} nom={nom} demoHorsLigne={demoHorsLigne} onLogout={logout} onStaffLogin={() => setConnexionPersonnel(true)} />;
}
