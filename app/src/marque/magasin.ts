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

const CLE_APPARENCE = 'priorix:apparence';
const CLE_LOCALES = 'priorix:marques-locales';

const PAR_DEFAUT = ORGANISATIONS_EMBARQUEES.find((o) => o.code === CODE_PAR_DEFAUT) ?? ORGANISATIONS_EMBARQUEES[0];

function calculer(organisation: Organisation, apparence: Apparence): Jetons {
  const base = completerCouleurs(organisation.couleurs, PAR_DEFAUT.couleurs as Couleurs);
  return jetonsDepuis(appliquerApparence(base, apparence, organisation.code));
}

/** Quatre couleurs réelles d'une apparence, pour la pastille d'aperçu : en-tête, fond, surface, action. */
export function apercuApparence(organisation: Organisation, apparence: Apparence): string[] {
  const j = calculer(organisation, apparence);
  return [j.header, j.background, j.surface, j.action];
}

function creerEtat(organisation: Organisation, apparence: Apparence, duPersonnel: boolean): EtatMarque {
  return { organisation, apparence, jetons: calculer(organisation, apparence), duPersonnel };
}

let etat: EtatMarque = creerEtat(PAR_DEFAUT, 'standard', false);
// Marque du citoyen (choisie par lui, gardée au redémarrage) : celle qui revient quand un compte du personnel se déconnecte.
let marqueCitoyen: Organisation = PAR_DEFAUT;
const ecouteurs = new Set<() => void>();
// Marques réglées par un administrateur quand la base ne peut pas les garder (migration pas lancée) : gardées sur le téléphone.
let locales: Record<string, Organisation> = {};

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

/** Après la connexion d'un compte du personnel : sa marque s'applique, la marque par défaut de l'app reste celle du citoyen (il ne choisit jamais la marque). */
export function appliquerMarquePersonnel(organisation: Organisation): void {
  etat = creerEtat(organisation, etat.apparence, true);
  notifier();
}

/** À la déconnexion : retour à la marque par défaut de l'app (Priorix aujourd'hui). */
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

function memeMarque(a: Organisation, b: Organisation): boolean {
  return a.code === b.code && a.nom_app === b.nom_app && (a.slogan ?? '') === (b.slogan ?? '') && a.logo === b.logo && JSON.stringify(a.couleurs) === JSON.stringify(b.couleurs);
}

/** L'organisation avec la marque réglée localement, s'il y en a une (sinon telle quelle). */
export function organisationAvecLocale(o: Organisation): Organisation {
  return locales[o.code] ?? o;
}

/** Marque réglée sur ce téléphone seulement : appliquée tout de suite ET gardée au redémarrage. */
export function garderMarqueLocale(organisation: Organisation): void {
  locales = { ...locales, [organisation.code]: organisation };
  void garder(CLE_LOCALES, JSON.stringify(locales));
  mettreAJourOrganisation(organisation);
}

/** La base a pris la marque : la copie locale n'a plus lieu d'être. */
export function oublierMarqueLocale(code: string): void {
  if (!locales[code]) return;
  const { [code]: _retire, ...reste } = locales;
  locales = reste;
  void garder(CLE_LOCALES, JSON.stringify(locales));
}

/**
 * Une organisation a changé (modifiée par un administrateur ici ou sur un autre téléphone) : si c'est celle qui est appliquée
 * (ou celle du citoyen), sa nouvelle marque se voit tout de suite.
 */
export function mettreAJourOrganisation(organisation: Organisation): void {
  // Une marque venue de la base (avec id) remplace la copie locale ; une marque identique à celle qui est appliquée ne reconstruit rien.
  if (organisation.id && locales[organisation.code]) oublierMarqueLocale(organisation.code);
  if (marqueCitoyen.code === organisation.code) marqueCitoyen = organisation;
  if (etat.organisation.code === organisation.code && !memeMarque(etat.organisation, organisation)) {
    etat = creerEtat(organisation, etat.apparence, etat.duPersonnel);
    notifier();
  }
}

/** Au démarrage : relit l'apparence et la marque du citoyen gardées sur le téléphone. */
export async function chargerMarqueLocale(organisations: Organisation[] = ORGANISATIONS_EMBARQUEES): Promise<void> {
  try {
    const st = stockage();
    if (!st) return;
    const [apparence, brut] = await Promise.all([st.getItem(CLE_APPARENCE), st.getItem(CLE_LOCALES)]);
    try {
      const l = brut ? JSON.parse(brut) : {};
      if (l && typeof l === 'object') locales = l as Record<string, Organisation>;
    } catch {
      locales = {};
    }
    const app = APPARENCES.find((a) => a === apparence) ?? etat.apparence;
    // Le citoyen ne choisit jamais la marque : même un ancien choix stocké est ignoré, c'est la marque par défaut de l'app.
    const base = organisations.find((o) => o.code === PAR_DEFAUT.code) ?? organisationEmbarquee(PAR_DEFAUT.code) ?? marqueCitoyen;
    const org = organisationAvecLocale(base);
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
  locales = {};
  etat = creerEtat(PAR_DEFAUT, 'standard', false);
  notifier();
}
