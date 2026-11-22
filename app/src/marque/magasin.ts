import { CODE_PAR_DEFAUT, ORGANISATIONS_EMBARQUEES, organisationEmbarquee, type Organisation } from './organisations-embarquees';

import { appliquerApparence, APPARENCES, completerCouleurs, jetonsDepuis, type Apparence, type Couleurs, type Jetons } from './jetons';

/** État de la marque : l'organisation appliquée, l'apparence choisie et les jetons qui en découlent. Tous les écrans le lisent. */
export type EtatMarque = {
  organisation: Organisation;
  apparence: Apparence;
  jetons: Jetons;
  /** Vrai quand la marque vient du compte du personnel connecté (la marque du citoyen revient à la déconnexion). */
  duPersonnel: boolean;
};

const CLE_CODE = 'priorix:marque-citoyen';
const CLE_APPARENCE = 'priorix:apparence';

const PAR_DEFAUT = ORGANISATIONS_EMBARQUEES.find((o) => o.code === CODE_PAR_DEFAUT) ?? ORGANISATIONS_EMBARQUEES[0];

function calculer(organisation: Organisation, apparence: Apparence): Jetons {
  const base = completerCouleurs(organisation.couleurs, PAR_DEFAUT.couleurs as Couleurs);
  return jetonsDepuis(appliquerApparence(base, apparence));
}

function creerEtat(organisation: Organisation, apparence: Apparence, duPersonnel: boolean): EtatMarque {
  return { organisation, apparence, jetons: calculer(organisation, apparence), duPersonnel };
}

let etat: EtatMarque = creerEtat(PAR_DEFAUT, 'standard', false);
// Marque du citoyen (choisie par lui, gardée au redémarrage) : celle qui revient quand un compte du personnel se déconnecte.
let marqueCitoyen: Organisation = PAR_DEFAUT;
const ecouteurs = new Set<() => void>();

function notifier() {
  ecouteurs.forEach((f) => f());
}

export function lireMarque(): EtatMarque {
  return etat;
}

export function abonnerMarque(rappel: () => void): () => void {
  ecouteurs.add(rappel);
  return () => {
    ecouteurs.delete(rappel);
  };
}

type Stockage = { getItem: (c: string) => Promise<string | null>; setItem: (c: string, v: string) => Promise<void> };

/** Le stockage du téléphone, chargé au premier usage : un module natif absent (tests, build ancienne) ne plante rien. */
function stockage(): Stockage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-async-storage/async-storage');
    return (m.default ?? m) as Stockage;
  } catch {
    return null;
  }
}

async function garder(cle: string, valeur: string) {
  try {
    await stockage()?.setItem(cle, valeur);
  } catch {
    // Le stockage peut manquer : la marque reste appliquée pour cette session.
  }
}

/** Le citoyen choisit une organisation (« Changer de ville ») : appliquée tout de suite et gardée au redémarrage. */
export function choisirMarqueCitoyen(organisation: Organisation): void {
  marqueCitoyen = organisation;
  etat = creerEtat(organisation, etat.apparence, false);
  notifier();
  void garder(CLE_CODE, organisation.code);
}

/** Après la connexion d'un compte du personnel : sa marque s'applique, sans toucher au choix du citoyen. */
export function appliquerMarquePersonnel(organisation: Organisation): void {
  etat = creerEtat(organisation, etat.apparence, true);
  notifier();
}

/** À la déconnexion : retour à la marque du citoyen. */
export function restaurerMarqueCitoyen(): void {
  if (!etat.duPersonnel && etat.organisation.code === marqueCitoyen.code) return;
  etat = creerEtat(marqueCitoyen, etat.apparence, false);
  notifier();
}

/** Apparence (Standard, Contraste élevé, Sombre) appliquée à la marque courante, gardée au redémarrage. */
export function definirApparence(apparence: Apparence): void {
  etat = creerEtat(etat.organisation, apparence, etat.duPersonnel);
  notifier();
  void garder(CLE_APPARENCE, apparence);
}

/**
 * Une organisation a changé (modifiée par un administrateur ici ou sur un autre téléphone) : si c'est celle qui est appliquée
 * (ou celle du citoyen), sa nouvelle marque se voit tout de suite.
 */
export function mettreAJourOrganisation(organisation: Organisation): void {
  if (marqueCitoyen.code === organisation.code) marqueCitoyen = organisation;
  if (etat.organisation.code === organisation.code) {
    etat = creerEtat(organisation, etat.apparence, etat.duPersonnel);
    notifier();
  }
}

/** Au démarrage : relit l'apparence et la marque du citoyen gardées sur le téléphone. */
export async function chargerMarqueLocale(organisations: Organisation[] = ORGANISATIONS_EMBARQUEES): Promise<void> {
  try {
    const st = stockage();
    if (!st) return;
    const [code, apparence] = await Promise.all([st.getItem(CLE_CODE), st.getItem(CLE_APPARENCE)]);
    const app = APPARENCES.find((a) => a === apparence) ?? etat.apparence;
    const org = (code ? (organisations.find((o) => o.code === code) ?? organisationEmbarquee(code)) : undefined) ?? marqueCitoyen;
    marqueCitoyen = org;
    etat = creerEtat(etat.duPersonnel ? etat.organisation : org, app, etat.duPersonnel);
    notifier();
  } catch {
    // Pas de stockage : marque par défaut.
  }
}

/** Pour les tests : retour à l'état d'origine. */
export function reinitialiserMarque(): void {
  marqueCitoyen = PAR_DEFAUT;
  etat = creerEtat(PAR_DEFAUT, 'standard', false);
  notifier();
}
