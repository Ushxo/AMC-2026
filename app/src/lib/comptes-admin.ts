import { estRefusOuAbsent } from './auth';
import { avecDelai } from './source';
import { getSupabase } from './supabase';

export type CompteListe = {
  id: string;
  /** Absent quand la liste vient de la table des profils (le courriel n'y est pas). */
  courriel: string | null;
  role: 'admin' | 'employe' | 'citoyen';
  poste: 'superviseur' | 'commis' | null;
  nom: string;
  organisation: string | null;
  equipe: string | null;
  creeLe: string | null;
};

export function libelleRoleCompte(c: Pick<CompteListe, 'role' | 'poste'>): string {
  if (c.role === 'admin') return 'Administrateur';
  if (c.role === 'employe') return c.poste === 'superviseur' ? 'Superviseur' : "Employé d'équipe";
  return 'Citoyen';
}

export type ListeComptes = {
  comptes: CompteListe[];
  /** Vrai quand la liste vient de la fonction complète (courriel, organisation, équipe) ; sinon de la table des profils. */
  complete: boolean;
};

const DELAI_MS = 6000;

function nomDe(prenom: unknown, nom: unknown, repli: string): string {
  const n = [prenom, nom].filter((x) => typeof x === 'string' && x).join(' ').trim();
  return n || repli;
}

/** Une ligne de la fonction liste_comptes_personnel() ou de la table profils. */
export function compteDepuisLigne(l: unknown): CompteListe | null {
  if (!l || typeof l !== 'object') return null;
  const o = l as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : typeof o.user_id === 'string' ? o.user_id : null;
  if (!id) return null;
  const role = o.role === 'admin' || o.role === 'employe' || o.role === 'citoyen' ? o.role : null;
  if (!role) return null;
  const courriel = typeof o.courriel === 'string' ? o.courriel : typeof o.email === 'string' ? o.email : null;
  return {
    id,
    courriel,
    role,
    poste: o.poste === 'superviseur' || o.poste === 'commis' ? o.poste : null,
    nom: nomDe(o.prenom, o.nom, courriel ?? 'Sans nom'),
    organisation: typeof o.organisation === 'string' ? o.organisation : null,
    equipe: typeof o.equipe === 'string' ? o.equipe : null,
    creeLe: typeof o.created_at === 'string' ? o.created_at : null,
  };
}

/**
 * Les comptes du personnel, pour un administrateur. D'abord la fonction liste_comptes_personnel() (courriel, organisation, équipe) ;
 * si elle n'existe pas encore, la table des profils (rôle et nom seulement : un admin la lit en entier).
 * Rend null si rien ne peut être lu.
 */
export async function listerComptes(): Promise<ListeComptes | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(client.rpc('liste_comptes_personnel'), DELAI_MS);
    if (!error && Array.isArray(data)) {
      return { comptes: data.map(compteDepuisLigne).filter((c): c is CompteListe => c !== null), complete: true };
    }
    if (error && !estRefusOuAbsent(error)) return null;
    const rep = await avecDelai(client.from('profils').select('id, role, poste, prenom, nom, created_at').in('role', ['admin', 'employe']).order('created_at', { ascending: false }), DELAI_MS);
    if (rep.error || !Array.isArray(rep.data)) return null;
    return { comptes: rep.data.map(compteDepuisLigne).filter((c): c is CompteListe => c !== null), complete: false };
  } catch {
    return null;
  }
}
