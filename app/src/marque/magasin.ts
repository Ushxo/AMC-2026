import { CODE_PAR_DEFAUT, ORGANISATIONS_EMBARQUEES, organisationEmbarquee, type Organisation } from './organisations-embarquees';

import { completerCouleurs, couleursAvecLisibilite, estSombre, jetonsDepuis, LISIBILITE_PAR_DEFAUT, type Couleurs, type Jetons, type Lisibilite } from './jetons';
import { estThemeId, PALETTES, THEME_ORGANISATION, type ThemeId } from './themes';

/** État de la marque : l'organisation appliquée, le thème et la lisibilité choisis, et les jetons qui en découlent. Tous les écrans le lisent. */
export type EtatMarque = {
  organisation: Organisation;
  /** Thème de couleurs choisi par la personne (« organisation » = la marque de l'organisation). */
  theme: ThemeId;
  lisibilite: Lisibilite;
  jetons: Jetons;
  /** Vrai quand la palette finale est sombre (la carte suit). */
  sombre: boolean;
  /** Vrai quand la marque vient du compte du personnel connecté (la marque du citoyen revient à la déconnexion). */
  duPersonnel: boolean;
};

const CLE_THEME = 'priorix:theme:';
const CLE_APPARENCE_ANCIENNE = 'priorix:apparence';
const CLE_LOCALES = 'priorix:marques-locales';

const PAR_DEFAUT = ORGANISATIONS_EMBARQUEES.find((o) => o.code === CODE_PAR_DEFAUT) ?? ORGANISATIONS_EMBARQUEES[0];

type Reglages = { theme: ThemeId; lisibilite: Lisibilite };
const REGLAGES_PAR_DEFAUT: Reglages = { theme: THEME_ORGANISATION, lisibilite: LISIBILITE_PAR_DEFAUT };

function palette(organisation: Organisation, { theme, lisibilite }: Reglages): Couleurs {
  const base = theme === THEME_ORGANISATION ? completerCouleurs(organisation.couleurs, PAR_DEFAUT.couleurs as Couleurs) : PALETTES[theme as Exclude<ThemeId, 'organisation'>];
  return couleursAvecLisibilite(base, lisibilite);
}

/** Les jetons d'un thème pour une organisation (aperçu fidèle dans le choix du thème). */
export function jetonsDuTheme(organisation: Organisation, theme: ThemeId, lisibilite: Lisibilite = LISIBILITE_PAR_DEFAUT): Jetons {
  return jetonsDepuis(palette(organisation, { theme, lisibilite }));
}

function creerEtat(organisation: Organisation, reglages: Reglages, duPersonnel: boolean): EtatMarque {
  const c = palette(organisation, reglages);
  return { organisation, theme: reglages.theme, lisibilite: reglages.lisibilite, jetons: jetonsDepuis(c), sombre: estSombre(c), duPersonnel };
}

function reglagesDe(e: EtatMarque): Reglages {
  return { theme: e.theme, lisibilite: e.lisibilite };
}

let etat: EtatMarque = creerEtat(PAR_DEFAUT, REGLAGES_PAR_DEFAUT, false);
// Personne dont les réglages de thème sont appliqués (« invite » sans compte) : le choix est gardé par personne.
let cleUtilisateur = 'invite';
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
  etat = creerEtat(organisation, reglagesDe(etat), true);
  notifier();
}

/** À la déconnexion : retour à la marque par défaut de l'app (Priorix aujourd'hui). */
export function restaurerMarqueCitoyen(): void {
  if (!etat.duPersonnel && etat.organisation.code === marqueCitoyen.code) return;
  etat = creerEtat(marqueCitoyen, reglagesDe(etat), false);
  notifier();
}

function garderReglages(): void {
  void garder(CLE_THEME + cleUtilisateur, JSON.stringify(reglagesDe(etat)));
}

/** Thème de couleurs choisi (appliqué tout de suite, gardé pour cette personne). */
export function definirTheme(theme: ThemeId): void {
  etat = creerEtat(etat.organisation, { ...reglagesDe(etat), theme }, etat.duPersonnel);
  notifier();
  garderReglages();
}

/** Contraste élevé : appliqué par-dessus le thème choisi. */
export function definirLisibilite(l: Partial<Lisibilite>): void {
  etat = creerEtat(etat.organisation, { theme: etat.theme, lisibilite: { ...etat.lisibilite, ...l } }, etat.duPersonnel);
  notifier();
  garderReglages();
}

function lireReglages(brut: string | null): Reglages | null {
  try {
    const v = brut ? JSON.parse(brut) : null;
    if (!v || typeof v !== 'object') return null;
    return { theme: estThemeId(v.theme) ? v.theme : THEME_ORGANISATION, lisibilite: { contraste: v.lisibilite?.contraste === true } /* une ancienne valeur « daltonisme » enregistrée est ignorée */ };
  } catch {
    return null;
  }
}

/** Réglages d'avant les thèmes : « sombre » devient le thème Nuit, « contraste » le contraste élevé ; « daltonisme » n'existe plus : thème de l'organisation, sans réglage. */
function reglagesAnciens(a: string | null): Reglages | null {
  if (a === 'sombre') return { theme: 'nuit', lisibilite: LISIBILITE_PAR_DEFAUT };
  if (a === 'contraste') return { theme: THEME_ORGANISATION, lisibilite: { contraste: true } };
  return null;
}

/** Applique les réglages de thème gardés pour cette personne (« invite » sans compte) ; rien de gardé : thème de l'organisation. */
export async function chargerReglagesTheme(cle: string = 'invite'): Promise<void> {
  cleUtilisateur = cle;
  try {
    const st = stockage();
    if (!st) return;
    const brut = await st.getItem(CLE_THEME + cle);
    const gardes = lireReglages(brut) ?? (cle === 'invite' ? reglagesAnciens(await st.getItem(CLE_APPARENCE_ANCIENNE)) : null) ?? REGLAGES_PAR_DEFAUT;
    if (cle !== cleUtilisateur) return; // une autre personne s'est connectée entre-temps
    etat = creerEtat(etat.organisation, gardes, etat.duPersonnel);
    notifier();
  } catch {
    // Pas de stockage : thème de l'organisation.
  }
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
    etat = creerEtat(organisation, reglagesDe(etat), etat.duPersonnel);
    notifier();
  }
}

/** Au démarrage : relit les marques réglées localement (et le thème gardé pour l'invité). */
export async function chargerMarqueLocale(organisations: Organisation[] = ORGANISATIONS_EMBARQUEES): Promise<void> {
  try {
    const st = stockage();
    if (!st) return;
    const brut = await st.getItem(CLE_LOCALES);
    try {
      const l = brut ? JSON.parse(brut) : {};
      if (l && typeof l === 'object') locales = l as Record<string, Organisation>;
    } catch {
      locales = {};
    }
    // Le citoyen ne choisit jamais la marque : même un ancien choix stocké est ignoré, c'est la marque par défaut de l'app.
    const base = organisations.find((o) => o.code === PAR_DEFAUT.code) ?? organisationEmbarquee(PAR_DEFAUT.code) ?? marqueCitoyen;
    const org = organisationAvecLocale(base);
    marqueCitoyen = org;
    etat = creerEtat(etat.duPersonnel ? etat.organisation : org, reglagesDe(etat), etat.duPersonnel);
    notifier();
    await chargerReglagesTheme(cleUtilisateur);
  } catch {
    // Pas de stockage : marque par défaut.
  }
}

/** Pour les tests : retour à l'état d'origine. */
export function reinitialiserMarque(): void {
  marqueCitoyen = PAR_DEFAUT;
  locales = {};
  etat = creerEtat(PAR_DEFAUT, REGLAGES_PAR_DEFAUT, false);
  cleUtilisateur = 'invite';
  notifier();
}
