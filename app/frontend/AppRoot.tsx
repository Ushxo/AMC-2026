import React, { useEffect, useState } from "react";


import { abonnerOrganisations, lireMonOrganisation, lireOrganisations } from "@/lib/organisations";
import { appliquerMarquePersonnel, chargerMarqueLocale, chargerReglagesTheme, mettreAJourOrganisation, restaurerMarqueCitoyen } from "@/marque/magasin";
import { BarreEtat } from "@/marque/barre-etat";
import { useMarque } from "@/marque/utiliser";
import { EcranOuverture } from "./components/EcranOuverture";
import { useAcces } from "@/hooks/use-acces";
import AuthFlow from "./auth/AuthFlow";
import CitizenApp from "./citizen/CitizenApp";
import StaffApp from "./StaffApp";
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
  const { ecran, pret, citoyen, nom, demoHorsLigne, deconnecter, identifiant } = useAcces();
  const [connexionPersonnel, setConnexionPersonnel] = useState(false);
  const logout = () => void deconnecter();

  // Le thème de couleurs est gardé par personne : il se recharge à chaque changement de compte (« invite » sans compte).
  useEffect(() => {
    void chargerReglagesTheme(identifiant ?? 'invite');
  }, [identifiant]);

  // La marque : relue au démarrage, rafraîchie depuis la base et suivie en direct (Realtime).
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
  // Le personnel ne voit jamais deux marques de suite : l'écran d'ouverture reste tant que la marque du compte n'est pas
  // appliquée (plafond de 4 s, puis repli sur la marque courante).
  const [marqueDuCompte, setMarqueDuCompte] = useState(false);
  useEffect(() => {
    if (!personnel) {
      restaurerMarqueCitoyen();
      setMarqueDuCompte(false);
      return;
    }
    let actif = true;
    const plafond = setTimeout(() => actif && setMarqueDuCompte(true), 4000);
    void lireMonOrganisation().then((o) => {
      if (!actif) return;
      if (o) appliquerMarquePersonnel(o);
      setMarqueDuCompte(true);
    });
    return () => {
      actif = false;
      clearTimeout(plafond);
    };
  }, [personnel]);

  // Une fois connecté (employé ou superviseur), la connexion se referme d'elle-même.
  useEffect(() => {
    if (ecran === "superviseur" || ecran === "employe" || ecran === "admin") setConnexionPersonnel(false);
  }, [ecran]);

  if (personnel && !marqueDuCompte) return <EcranOuverture />;
  if (ecran === "admin") return <AdminApp onLogout={logout} />;
  if (ecran === "superviseur") return <SupervisorApp onLogout={logout} />;
  if (ecran === "employe") return <StaffApp onLogout={logout} />;
  // Reprise de la session gardée : un bref chargement évite que la carte clignote chez le personnel déjà connecté.
  if (!pret && !citoyen) return <EcranOuverture />;
  if (connexionPersonnel) return <AuthFlow onConnecte={() => setConnexionPersonnel(false)} onRetour={() => setConnexionPersonnel(false)} />;
  return <CitizenApp compteConnecte={ecran === "citoyen"} nom={nom} demoHorsLigne={demoHorsLigne} onLogout={logout} onStaffLogin={() => setConnexionPersonnel(true)} />;
}
