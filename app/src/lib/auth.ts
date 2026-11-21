// Couche auth de l'app : à appeler depuis les écrans, sans toucher à Supabase.
//
//   const profil = await connecter(email, motDePasse);
//   if (profil.role === 'admin') ...
//
// Toutes les fonctions lèvent une ErreurAuth avec un message en français
// affichable tel quel à l'utilisateur.

import { FunctionsHttpError, type AuthError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

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
  const { data, error } = await supabase.auth.signUp({
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
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: motDePasse,
  });
  if (error) throw erreurDepuisAuth(error);
  return exigerProfil();
}

export async function deconnecter(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw erreurDepuisAuth(error);
}

/** Profil de l'utilisateur connecté, ou null si personne n'est connecté. */
export async function monProfil(): Promise<Profil | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase.rpc('mon_profil');
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
  const { data } = supabase.auth.onAuthStateChange((_evenement, session) => {
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
  const { data, error } = await supabase.functions.invoke('creer-utilisateur', {
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
