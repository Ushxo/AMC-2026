import { estRefusOuAbsent } from './auth';
import { avecDelai } from './source';
import { getSupabase } from './supabase';
import { CLES_COULEURS, ORGANISATIONS_EMBARQUEES, type Couleurs, type Organisation } from '@/marque/organisations-embarquees';

export * from '@/marque/organisations-embarquees';

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

/** Dit quand une organisation change dans la base (marque modifiée par un administrateur, sur n'importe quel téléphone). */
export function abonnerOrganisations(rappel: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  try {
    const canal = client
      .channel(`organisations-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, rappel)
      .subscribe();
    return () => {
      void client.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}
