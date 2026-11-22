import { estRefusOuAbsent } from './auth';
import { abonnerTable } from './canal-partage';
import { avecDelai } from './source';
import { getSupabase } from './supabase';
import { CLES_COULEURS, ORGANISATIONS_EMBARQUEES, type Couleurs, type Organisation, type TextesOrganisation } from '@/marque/organisations-embarquees';

export * from '@/marque/organisations-embarquees';

const DELAI_MS = 5000;
const CHAMPS_BASE = 'id, code, nom, nom_app, slogan, logo, couleurs';
const CHAMPS = `${CHAMPS_BASE}, service, textes`;

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
    service: typeof o.service === 'string' && o.service.trim() ? o.service.trim() : null,
    textes: textesDepuis(o.textes),
  };
}

function textesDepuis(v: unknown): Partial<TextesOrganisation> {
  const out: Partial<TextesOrganisation> = {};
  if (v && typeof v === 'object') {
    const t = v as Record<string, unknown>;
    if (typeof t.titreCarte === 'string' && t.titreCarte.trim()) out.titreCarte = t.titreCarte.trim().slice(0, 60);
    if (typeof t.rechercheAdresse === 'string' && t.rechercheAdresse.trim()) out.rechercheAdresse = t.rechercheAdresse.trim().slice(0, 80);
  }
  return out;
}

/** Vrai quand l'erreur dit qu'une colonne manque (migration 0010 pas lancée). */
function colonneAbsente(e: unknown): boolean {
  return /service|textes/i.test(String((e as { message?: unknown } | null)?.message ?? '')) && /column|colonne|schema cache|PGRST204/i.test(String((e as { message?: unknown; code?: unknown } | null)?.message ?? '') + String((e as { code?: unknown } | null)?.code ?? ''));
}

/** Les organisations : celles de la base quand elle répond (migration 0009 lancée), sinon les deux marques embarquées. */
export async function lireOrganisations(): Promise<{ organisations: Organisation[]; enBase: boolean }> {
  const client = getSupabase();
  if (!client) return { organisations: ORGANISATIONS_EMBARQUEES, enBase: false };
  try {
    let { data, error } = (await avecDelai(client.from('organisations').select(CHAMPS), DELAI_MS)) as { data: unknown; error: { message?: string; code?: string } | null };
    // Migration 0010 pas lancée : on relit sans le service ni les textes.
    if (error && colonneAbsente(error)) ({ data, error } = (await avecDelai(client.from('organisations').select(CHAMPS_BASE), DELAI_MS)) as { data: unknown; error: { message?: string; code?: string } | null });
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
  const base = { nom: o.nom, nom_app: o.nom_app, slogan: o.slogan, logo: o.logo, couleurs: o.couleurs };
  try {
    let { error } = await avecDelai(client.from('organisations').update({ ...base, service: o.service ?? null, textes: o.textes ?? {} }).eq('id', o.id), DELAI_MS);
    if (error && colonneAbsente(error)) ({ error } = await avecDelai(client.from('organisations').update(base).eq('id', o.id), DELAI_MS));
    return error ? messageOrganisation(error) : null;
  } catch {
    return MESSAGE_ORGANISATION_ECHEC;
  }
}

/** Code d'organisation à partir de son nom : minuscules, sans accents, tirets ; unique parmi les codes existants. */
export function codeDepuisNom(nom: string, existants: string[]): string {
  const base =
    nom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'organisation';
  let code = base;
  for (let n = 2; existants.includes(code); n++) code = `${base}-${n}`;
  return code;
}

export const MESSAGE_ORGANISATION_NOM = "Entrez le nom de l'organisation (60 caractères au plus).";
export const MESSAGE_ORGANISATION_MIGRATION_0010 = "La création d'organisation n'est pas encore disponible sur le serveur (migration 0010 à lancer).";

/** Crée une organisation (réservé aux admins par la base, migration 0010). Rend un message d'erreur, ou null. */
export async function creerOrganisation(o: Organisation): Promise<string | null> {
  const nom = o.nom.trim();
  if (!nom || nom.length > 60) return MESSAGE_ORGANISATION_NOM;
  const client = getSupabase();
  if (!client) return MESSAGE_ORGANISATION_MIGRATION_0010;
  try {
    const { error } = await avecDelai(
      client.from('organisations').insert({
        code: o.code,
        nom,
        nom_app: o.nom_app.trim() || nom,
        slogan: o.slogan,
        logo: o.logo,
        couleurs: o.couleurs,
        service: o.service ?? null,
        textes: o.textes ?? {},
      }),
      DELAI_MS,
    );
    if (!error) return null;
    if (colonneAbsente(error)) return MESSAGE_ORGANISATION_MIGRATION_0010;
    if (/duplicate|unique|23505/i.test(String(error.message) + String(error.code))) return 'Une organisation porte déjà ce code. Changez le nom.';
    if (/row-level security|42501|violates/i.test(String(error.message) + String(error.code))) return 'Seul un administrateur peut créer une organisation.';
    return messageOrganisation(error);
  } catch {
    return MESSAGE_ORGANISATION_ECHEC;
  }
}

/** Dit quand une organisation change dans la base : le canal Realtime est partagé (src/lib/canal-partage.ts). */
export function abonnerOrganisations(rappel: () => void): () => void {
  return abonnerTable('organisations', rappel);
}
