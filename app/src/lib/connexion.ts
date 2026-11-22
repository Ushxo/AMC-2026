import { ErreurAuth, inscrireCitoyen, lireIdentite } from './auth';
import { MESSAGE_CONNEXION_REFUSEE, MESSAGE_CONNEXION_RESEAU, MESSAGE_PANNE_EMPLOYES } from './messages';
import { definirAvertissement, definirCitoyen, definirEmploye, peutGerer } from './session';
import { getSupabase } from './supabase';

export type EcranRole = 'citoyen' | 'employe' | 'superviseur' | 'admin';

export type ResultatConnexion = { ok: true; ecran: EcranRole } | { ok: false; message: string };

export const MESSAGE_COMPTE_NON_CONFIGURE = "Ce compte n'est pas encore configuré. Contactez la Ville.";

/**
 * Connexion unique de l'application : un citoyen, un employé ou un superviseur entrent par le même écran.
 * Rend l'écran à ouvrir selon le profil lu dans la base.
 */
export async function ouvrirSession(courriel: string, motDePasse: string): Promise<ResultatConnexion> {
  const client = getSupabase();
  if (!client) return { ok: false, message: MESSAGE_CONNEXION_RESEAU };
  definirAvertissement(null);
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: courriel.trim(), password: motDePasse });
    if (error) {
      return { ok: false, message: error.name === 'AuthRetryableFetchError' ? MESSAGE_CONNEXION_RESEAU : MESSAGE_CONNEXION_REFUSEE };
    }
    let identite: Awaited<ReturnType<typeof lireIdentite>>;
    try {
      identite = await lireIdentite(data.user.id, data.user.email ?? courriel.trim());
    } catch {
      return { ok: false, message: MESSAGE_PANNE_EMPLOYES }; // panne de lecture : la session est gardée
    }
    if (!identite) {
      await client.auth.signOut();
      return { ok: false, message: MESSAGE_COMPTE_NON_CONFIGURE };
    }
    if (identite.type === 'employe') {
      definirEmploye(identite.acces.employe, identite.acces.role);
      return { ok: true, ecran: identite.acces.role === 'admin' ? 'admin' : peutGerer(identite.acces.role) ? 'superviseur' : 'employe' };
    }
    definirCitoyen(identite.citoyen);
    return { ok: true, ecran: 'citoyen' };
  } catch {
    return { ok: false, message: MESSAGE_CONNEXION_RESEAU };
  }
}

/** Inscription publique d'un citoyen : rend un message d'erreur lisible, ou null si le compte est créé et connecté. */
export async function creerCompteCitoyen(infos: { courriel: string; motDePasse: string; prenom?: string; nom?: string }): Promise<string | null> {
  if (!getSupabase()) return MESSAGE_CONNEXION_RESEAU;
  try {
    const profil = await inscrireCitoyen({ email: infos.courriel, motDePasse: infos.motDePasse, prenom: infos.prenom, nom: infos.nom });
    const nom = [profil.prenom, profil.nom].filter(Boolean).join(' ').trim() || infos.courriel.trim();
    definirCitoyen({ user_id: profil.id, nom, courriel: infos.courriel.trim() });
    return null;
  } catch (e) {
    return e instanceof ErreurAuth ? e.message : MESSAGE_CONNEXION_RESEAU;
  }
}
