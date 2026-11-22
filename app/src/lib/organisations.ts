import { estRefusOuAbsent } from './auth';
import { avecDelai } from './source';
import { getSupabase } from './supabase';

/** Les jetons de couleur que l'organisation peut régler (mêmes noms que la palette de l'interface). */
export const CLES_COULEURS = [
  'text',
  'textSecondary',
  'background',
  'backgroundElement',
  'backgroundSelected',
  'primary',
  'onPrimary',
  'accent',
  'accentDoux',
  'action',
  'onAction',
  'header',
  'onHeader',
  'surface',
  'border',
  'borderForte',
  'success',
  'danger',
] as const;
export type CleCouleur = (typeof CLES_COULEURS)[number];
export type Couleurs = Record<CleCouleur, string>;

/** Logos embarqués dans l'app (la base ne garde que la clé : l'app marche sans réseau). */
export type CleLogo = 'priorix' | 'fleur';
export const CLES_LOGO: CleLogo[] = ['priorix', 'fleur'];

export type Organisation = {
  /** Absent pour les marques embarquées pas encore lues en base. */
  id?: string;
  code: string;
  nom: string;
  nom_app: string;
  slogan: string | null;
  logo: string;
  couleurs: Partial<Couleurs>;
};

const COULEURS_PRIORIX: Couleurs = {
  text: '#2A1D14',
  textSecondary: '#5F665C',
  background: '#F5F3ED',
  backgroundElement: '#EEF2EA',
  backgroundSelected: '#C6D2C0',
  primary: '#1D3A1B',
  onPrimary: '#FFFFFF',
  accent: '#EE5F12',
  accentDoux: '#F28A33',
  action: '#B84A0B',
  onAction: '#FFFFFF',
  header: '#1D3A1B',
  onHeader: '#F8F4EA',
  surface: '#FFFFFF',
  border: '#D8E0D2',
  borderForte: '#7F8A7B',
  success: '#4F7A57',
  danger: '#B3261E',
};

const COULEURS_MONTREAL: Couleurs = {
  text: '#1F1A1A',
  textSecondary: '#5E5557',
  background: '#FBF8F8',
  backgroundElement: '#F6E9EA',
  backgroundSelected: '#F2CED1',
  primary: '#B5121B',
  onPrimary: '#FFFFFF',
  accent: '#B5121B',
  accentDoux: '#D8343C',
  action: '#8F0E15',
  onAction: '#FFFFFF',
  header: '#B5121B',
  onHeader: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E8D5D7',
  borderForte: '#8A7577',
  success: '#2F6B3A',
  danger: '#8F0E15',
};

/** Les deux marques embarquées : mêmes valeurs que la migration 0009 (repli sans réseau ou sans migration). */
export const ORGANISATIONS_EMBARQUEES: Organisation[] = [
  { code: 'priorix', nom: 'Priorix', nom_app: 'Priorix', slogan: 'Chaque équipe sait par où commencer.', logo: 'priorix', couleurs: COULEURS_PRIORIX },
  { code: 'montreal', nom: 'Ville de Montréal', nom_app: 'Égouts Montréal', slogan: "Signalez, on s'en occupe.", logo: 'fleur', couleurs: COULEURS_MONTREAL },
];
export const CODE_PAR_DEFAUT = 'priorix';

export function organisationEmbarquee(code: string): Organisation | undefined {
  return ORGANISATIONS_EMBARQUEES.find((o) => o.code === code);
}

const DELAI_MS = 5000;
const CHAMPS = 'id, code, nom, nom_app, slogan, logo, couleurs';

/** Une ligne de la table organisations, lue sous n'importe quelle forme raisonnable ; null si elle est inutilisable. */
export function organisationDepuisLigne(l: unknown): Organisation | null {
  if (!l || typeof l !== 'object') return null;
  const o = l as Record<string, unknown>;
  if (typeof o.code !== 'string' || !o.code || typeof o.nom !== 'string') return null;
  const couleurs: Partial<Couleurs> = {};
  if (o.couleurs && typeof o.couleurs === 'object') {
    for (const k of CLES_COULEURS) {
      const v = (o.couleurs as Record<string, unknown>)[k];
      if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) couleurs[k] = v.toUpperCase();
    }
  }
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    code: o.code,
    nom: o.nom,
    nom_app: typeof o.nom_app === 'string' && o.nom_app ? o.nom_app : o.nom,
    slogan: typeof o.slogan === 'string' ? o.slogan : null,
    logo: typeof o.logo === 'string' ? o.logo : 'priorix',
    couleurs,
  };
}

/** Les organisations : celles de la base quand elle répond (migration 0009 lancée), sinon les deux marques embarquées. */
export async function lireOrganisations(): Promise<{ organisations: Organisation[]; enBase: boolean }> {
  const client = getSupabase();
  if (!client) return { organisations: ORGANISATIONS_EMBARQUEES, enBase: false };
  try {
    const { data, error } = await avecDelai(client.from('organisations').select(CHAMPS), DELAI_MS);
    if (error || !Array.isArray(data)) return { organisations: ORGANISATIONS_EMBARQUEES, enBase: false };
    const lues = data.map(organisationDepuisLigne).filter((o): o is Organisation => o !== null);
    return lues.length > 0 ? { organisations: lues, enBase: true } : { organisations: ORGANISATIONS_EMBARQUEES, enBase: false };
  } catch {
    return { organisations: ORGANISATIONS_EMBARQUEES, enBase: false };
  }
}

/** L'organisation du compte connecté (fonction mon_organisation de la migration 0009) ; null si la fonction n'existe pas encore. */
export async function lireMonOrganisation(): Promise<Organisation | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(client.rpc('mon_organisation'), DELAI_MS);
    if (error) return null;
    return organisationDepuisLigne(Array.isArray(data) ? data[0] : data);
  } catch {
    return null;
  }
}

export const MESSAGE_MIGRATION_ORGANISATIONS = "La gestion des organisations n'est pas encore disponible sur le serveur (migration 0009 à lancer).";
export const MESSAGE_ORGANISATION_ECHEC = "L'enregistrement n'a pas pu se faire. Réessayez dans un moment.";

function messageOrganisation(e: unknown): string {
  const texte = String((e as { message?: unknown } | null)?.message ?? '');
  if (/Réservé aux administrateurs/i.test(texte)) return 'Seul un administrateur peut faire ce changement.';
  if (/Aucun compte/i.test(texte)) return 'Aucun compte avec ce courriel.';
  if (/pas partie du personnel|ne fait pas partie/i.test(texte)) return 'Ce compte ne fait pas partie du personnel.';
  if (/Organisation introuvable/i.test(texte)) return 'Organisation introuvable.';
  if (/could not find the function|does not exist|PGRST202/i.test(texte) || estRefusOuAbsent(e)) return MESSAGE_MIGRATION_ORGANISATIONS;
  return MESSAGE_ORGANISATION_ECHEC;
}

/** Range un compte du personnel dans une organisation (fonction definir_organisation_compte, réservée aux admins). Rend un message d'erreur, ou null. */
export async function definirOrganisationCompte(courriel: string, code: string): Promise<string | null> {
  const c = courriel.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'Entrez le courriel du compte.';
  const client = getSupabase();
  if (!client) return MESSAGE_ORGANISATION_ECHEC;
  try {
    const { error } = await avecDelai(client.rpc('definir_organisation_compte', { p_courriel: c, p_code: code }), DELAI_MS);
    return error ? messageOrganisation(error) : null;
  } catch {
    return MESSAGE_ORGANISATION_ECHEC;
  }
}

/** Enregistre la marque d'une organisation (réservé aux admins par la base). Rend un message d'erreur, ou null. */
export async function enregistrerOrganisation(o: Organisation): Promise<string | null> {
  const client = getSupabase();
  if (!client || !o.id) return MESSAGE_MIGRATION_ORGANISATIONS;
  try {
    const { error } = await avecDelai(
      client.from('organisations').update({ nom: o.nom, nom_app: o.nom_app, slogan: o.slogan, logo: o.logo, couleurs: o.couleurs }).eq('id', o.id),
      DELAI_MS,
    );
    return error ? messageOrganisation(error) : null;
  } catch {
    return MESSAGE_ORGANISATION_ECHEC;
  }
}
