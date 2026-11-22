import { FunctionsHttpError, type AuthError } from '@supabase/supabase-js';
import type { Employe } from '../types';
import {
  MESSAGE_COMPTE_CREE,
  MESSAGE_CONFIRMER_COURRIEL,
  MESSAGE_CONNEXION_RESEAU,
  MESSAGE_COURRIEL_INVALIDE,
  MESSAGE_COURRIEL_UTILISE,
  MESSAGE_INSCRIPTION_ECHEC,
  MESSAGE_MOT_DE_PASSE_COURT,
  MESSAGE_PANNE_EMPLOYES,
  MESSAGE_PAS_EMPLOYE,
  MESSAGE_SESSION_EXPIREE,
} from './messages';
import {
  definirAvertissement,
  definirEmploye,
  employeCourant,
  estEmployeDemo,
  type RoleVille,
} from './session';
import { getSupabase } from './supabase';

export type Acces = { employe: Employe; role: RoleVille };

/** Rôle effectif d'une ligne de la table profils : admin, superviseur (employé avec ce poste), employé ou aucun. */
export function roleDepuisProfil(role: unknown, poste: unknown): RoleVille | null {
  if (role === 'admin') return 'admin';
  if (role === 'superviseur') return 'superviseur';
  if (role === 'employe') return poste === 'superviseur' ? 'superviseur' : 'employe';
  return null; // citoyen ou valeur inconnue : pas d'accès au mode Ville
}

type ProfilBrut = { role?: unknown; poste?: unknown; prenom?: unknown; nom?: unknown };

/** Lit un profil sous n'importe quelle forme raisonnable : objet, liste d'un objet, ou simple texte (le rôle). */
export function normaliserProfil(brut: unknown): ProfilBrut | null {
  if (brut === null || brut === undefined) return null;
  if (typeof brut === 'string') return { role: brut };
  if (Array.isArray(brut)) return normaliserProfil(brut[0]);
  if (typeof brut === 'object') {
    const o = brut as Record<string, unknown>;
    return { role: o.role, poste: o.poste, prenom: o.prenom, nom: o.nom };
  }
  return null;
}

/** Refus d'accès ou fonction absente : on passe à la source suivante. Toute autre erreur est une panne. */
export function estRefusOuAbsent(erreur: unknown): boolean {
  if (!erreur || typeof erreur !== 'object') return false;
  const e = erreur as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const statut = Number(e.status);
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    ['42501', '42883', 'PGRST301', 'PGRST202', 'PGRST205'].includes(code) ||
    [401, 403, 404].includes(statut) ||
    /permission denied|not authorized|could not find the function|does not exist/i.test(message)
  );
}

/** Un profil « connu » a un rôle lisible : il décide seul, même s'il refuse l'accès (citoyen). */
function evaluerProfil(
  p: ProfilBrut | null,
  userId: string,
  courriel: string,
): { connu: boolean; acces: Acces | null } {
  const connu = !!p && typeof p.role === 'string' && p.role !== '';
  if (!p || !connu) return { connu: false, acces: null };
  const role = roleDepuisProfil(p.role, p.poste);
  if (!role) return { connu: true, acces: null };
  const nom = [p.prenom, p.nom].filter((x) => typeof x === 'string' && x).join(' ').trim() || courriel;
  return { connu: true, acces: { employe: { user_id: userId, nom, courriel }, role } };
}

/**
 * Accès de ce compte au mode Ville, dans l'ordre : rpc('mon_profil'), rpc('mon_role'), table `profils`.
 * Comme dans la base, le profil décide : s'il existe (même citoyen), la table `employes` est ignorée.
 * Elle ne sert qu'aux comptes de démonstration SANS profil (traités comme superviseurs).
 * Une source qui refuse ou n'existe pas est sautée ; une panne est propagée (une panne n'est pas « pas employé »).
 */
export async function lireAcces(userId: string, courriel: string): Promise<Acces | null> {
  const client = getSupabase();
  if (!client) return null;

  for (const fonction of ['mon_profil', 'mon_role']) {
    const r = await client.rpc(fonction);
    if (r.error) {
      if (estRefusOuAbsent(r.error)) continue;
      throw r.error;
    }
    const e = evaluerProfil(normaliserProfil(r.data), userId, courriel);
    if (e.connu) return e.acces;
  }

  const profil = await client.from('profils').select('role, poste, prenom, nom').eq('id', userId).maybeSingle();
  if (profil.error && !estRefusOuAbsent(profil.error)) throw profil.error;
  const depuisTable = evaluerProfil(normaliserProfil(profil.data), userId, courriel);
  if (depuisTable.connu) return depuisTable.acces;

  // Aucun profil : compte de démonstration de la table employes.
  const { data, error } = await client.from('employes').select('user_id, nom').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data
    ? { employe: { user_id: userId, nom: data.nom as string, courriel }, role: 'superviseur' }
    : null;
}

export async function lireEmploye(userId: string, courriel: string): Promise<Employe | null> {
  return (await lireAcces(userId, courriel))?.employe ?? null;
}

/** Au démarrage : reprend la session gardée. Un compte sans accès est déconnecté avec un message. */
export async function restaurerSession(): Promise<void> {
  const client = getSupabase();
  if (!client || employeCourant()) return;
  try {
    const { data } = await client.auth.getSession();
    const u = data.session?.user;
    if (!u) return;
    await adopterCompte(u.id, u.email ?? '');
  } catch {
    // Réseau absent : l'écran de connexion s'affiche.
  }
}

async function adopterCompte(userId: string, courriel: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  let acces: Acces | null;
  try {
    acces = await lireAcces(userId, courriel);
  } catch {
    definirAvertissement(MESSAGE_PANNE_EMPLOYES); // lecture en panne : la session est gardée
    return;
  }
  if (acces) {
    if (!employeCourant()) definirEmploye(acces.employe, acces.role);
  } else {
    await client.auth.signOut();
    definirAvertissement(MESSAGE_PAS_EMPLOYE);
  }
}

/**
 * Session expirée ou fermée ailleurs : retour à la connexion avec un message.
 * Une connexion faite par un autre écran (la session Supabase est partagée) est reprise ici.
 */
export function surveillerSession(): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((evenement, session) => {
    const e = employeCourant();
    if (evenement === 'SIGNED_OUT' && e && !estEmployeDemo(e)) {
      definirEmploye(null);
      definirAvertissement(MESSAGE_SESSION_EXPIREE);
    }
    if (evenement === 'SIGNED_IN' && !e && session?.user && !inscriptionEnCours) {
      // Hors du rappel : le client Supabase interdit d'attendre ses propres appels ici.
      const u = session.user;
      setTimeout(() => void adopterCompte(u.id, u.email ?? ''), 0);
    }
  });
  return () => data.subscription.unsubscribe();
}

// --- Création de compte ---

let inscriptionEnCours = false;

export const MOT_DE_PASSE_MIN = 8;

export type ResultatInscription =
  | { statut: 'cree' | 'confirmation'; message: string }
  | { statut: 'erreur'; message: string };

/** Message d'erreur en français simple, ou null si le courriel et le mot de passe sont acceptables. */
export function validerInscription(courriel: string, motDePasse: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel.trim())) return MESSAGE_COURRIEL_INVALIDE;
  if (motDePasse.length < MOT_DE_PASSE_MIN) return MESSAGE_MOT_DE_PASSE_COURT;
  return null;
}

function messageErreurInscription(erreur: { code?: unknown; name?: unknown; message?: unknown; status?: unknown }): string {
  const code = typeof erreur.code === 'string' ? erreur.code : '';
  const message = typeof erreur.message === 'string' ? erreur.message : '';
  if (code === 'user_already_exists' || code === 'email_exists' || /already (registered|exists)/i.test(message)) {
    return MESSAGE_COURRIEL_UTILISE;
  }
  if (code === 'weak_password' || /password/i.test(message)) return MESSAGE_MOT_DE_PASSE_COURT;
  if (erreur.name === 'AuthRetryableFetchError' || /network|fetch/i.test(message)) return MESSAGE_CONNEXION_RESEAU;
  return MESSAGE_INSCRIPTION_ECHEC;
}

/**
 * Crée un compte par courriel et mot de passe. Le compte est un citoyen : le mode Ville le refuse tant qu'un
 * administrateur ne lui a pas donné le rôle d'employé. L'app ne modifie jamais la table `profils`.
 * Si Supabase ouvre une session à la création, on la ferme tout de suite pour ne pas laisser l'écran bloqué.
 */
export async function creerCompte(
  courriel: string,
  motDePasse: string,
  prenom?: string,
  nom?: string,
): Promise<ResultatInscription> {
  const invalide = validerInscription(courriel, motDePasse);
  if (invalide) return { statut: 'erreur', message: invalide };
  const client = getSupabase();
  if (!client) return { statut: 'erreur', message: MESSAGE_CONNEXION_RESEAU };
  inscriptionEnCours = true;
  try {
    const donnees: Record<string, string> = {};
    if (prenom?.trim()) donnees.prenom = prenom.trim();
    if (nom?.trim()) donnees.nom = nom.trim();
    const { data, error } = await client.auth.signUp({
      email: courriel.trim(),
      password: motDePasse,
      options: { data: donnees },
    });
    if (error) return { statut: 'erreur', message: messageErreurInscription(error) };
    // Courriel déjà inscrit avec confirmation par courriel : Supabase répond sans erreur, sans identité.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { statut: 'erreur', message: MESSAGE_COURRIEL_UTILISE };
    }
    if (data.session) {
      await client.auth.signOut().catch(() => undefined);
      return { statut: 'cree', message: MESSAGE_COMPTE_CREE };
    }
    return { statut: 'confirmation', message: MESSAGE_CONFIRMER_COURRIEL };
  } catch (e) {
    return { statut: 'erreur', message: messageErreurInscription((e ?? {}) as Record<string, unknown>) };
  } finally {
    inscriptionEnCours = false;
  }
}

// ---------- Comptes et profils : inscription, connexion, rôles ----------
// À appeler depuis les écrans, sans toucher à Supabase. Toutes ces fonctions lèvent une ErreurAuth
// avec un message en français affichable tel quel.

function client() {
  const c = getSupabase();
  if (!c) throw new ErreurAuth('Connexion au serveur indisponible.');
  return c;
}

export type Role = 'citoyen' | 'employe' | 'admin';
export type Poste = 'superviseur' | 'commis';

export type Profil = {
  id: string;
  role: Role;
  /** Seulement pour role = 'employe'. */
  poste: Poste | null;
  prenom: string | null;
  nom: string | null;
  created_at: string;
};

export class ErreurAuth extends Error {
  constructor(
    message: string,
    /** Code Supabase ou statut HTTP, pour du traitement précis si besoin. */
    readonly code?: string | number,
  ) {
    super(message);
    this.name = 'ErreurAuth';
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  user_already_exists: 'Un compte existe déjà avec cet email.',
  email_exists: 'Un compte existe déjà avec cet email.',
  email_address_invalid: 'Adresse email invalide.',
  weak_password: 'Mot de passe trop faible.',
  email_not_confirmed: 'Email pas encore confirmé.',
  over_request_rate_limit: 'Trop de tentatives, réessaie dans quelques minutes.',
  over_email_send_rate_limit: 'Trop de tentatives, réessaie dans quelques minutes.',
};

function erreurDepuisAuth(erreur: AuthError): ErreurAuth {
  const code = erreur.code ?? erreur.status;
  const message = (erreur.code && MESSAGES[erreur.code]) || erreur.message;
  return new ErreurAuth(message, code);
}

/** Inscription publique. Donne toujours un compte citoyen. */
export async function inscrireCitoyen(infos: {
  email: string;
  motDePasse: string;
  prenom?: string;
  nom?: string;
}): Promise<Profil> {
  const { data, error } = await client().auth.signUp({
    email: infos.email.trim(),
    password: infos.motDePasse,
    options: { data: { prenom: infos.prenom, nom: infos.nom } },
  });
  if (error) throw erreurDepuisAuth(error);
  if (!data.session) {
    // Arrive seulement si « Confirm email » est réactivé dans Supabase.
    throw new ErreurAuth('Compte créé : confirme ton email puis connecte-toi.', 'email_not_confirmed');
  }
  return exigerProfil();
}

/** Login des trois rôles. Renvoie le profil pour choisir l'écran à afficher. */
export async function connecter(email: string, motDePasse: string): Promise<Profil> {
  const { error } = await client().auth.signInWithPassword({
    email: email.trim(),
    password: motDePasse,
  });
  if (error) throw erreurDepuisAuth(error);
  return exigerProfil();
}

export async function deconnecter(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw erreurDepuisAuth(error);
}

/** Profil de l'utilisateur connecté, ou null si personne n'est connecté. */
export async function monProfil(): Promise<Profil | null> {
  const { data: session } = await client().auth.getSession();
  if (!session.session) return null;

  const { data, error } = await client().rpc('mon_profil');
  if (error) throw new ErreurAuth('Impossible de charger le profil.', error.code);
  const profil = data as Profil | null;
  return profil?.id ? profil : null;
}

async function exigerProfil(): Promise<Profil> {
  const profil = await monProfil();
  if (!profil) throw new ErreurAuth('Profil introuvable pour ce compte.');
  return profil;
}

/**
 * Appelé à chaque connexion, déconnexion ou rafraîchissement de session,
 * avec le profil à jour (null = déconnecté). Renvoie la fonction pour se désabonner.
 */
export function surChangementDeSession(rappel: (profil: Profil | null) => void): () => void {
  const { data } = client().auth.onAuthStateChange((_evenement, session) => {
    // Pas d'appel Supabase directement dans ce rappel (risque de blocage) :
    // on le repousse au tour suivant.
    setTimeout(() => {
      if (!session) return rappel(null);
      monProfil().then(rappel, () => rappel(null));
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}

export type NouvelUtilisateur =
  | { role: 'employe'; poste: Poste; email: string; motDePasse: string; prenom?: string; nom?: string }
  | { role: 'admin' | 'citoyen'; email: string; motDePasse: string; prenom?: string; nom?: string };

/** Réservé aux admins : crée un employé (avec poste), un admin ou un citoyen. */
export async function creerUtilisateur(
  infos: NouvelUtilisateur,
): Promise<Profil & { email: string }> {
  const { motDePasse, ...reste } = infos;
  const { data, error } = await client().functions.invoke('creer-utilisateur', {
    body: { ...reste, email: infos.email.trim(), password: motDePasse },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const reponse = error.context as Response;
      const corps = await reponse.json().catch(() => null);
      throw new ErreurAuth(corps?.erreur ?? 'Création du compte impossible.', reponse.status);
    }
    throw new ErreurAuth('Serveur injoignable, réessaie.');
  }
  return data;
}
