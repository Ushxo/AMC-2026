import { associerCompte } from './equipe-compte';
import { creerUtilisateur, ErreurAuth, MOT_DE_PASSE_MIN, type NouvelUtilisateur } from './auth';

/** Les trois rôles que l'administrateur peut donner au personnel. */
export type RolePersonnel = 'equipe' | 'superviseur' | 'admin';

export const LIBELLES_ROLE_PERSONNEL: Record<RolePersonnel, string> = {
  equipe: "Employé d'équipe",
  superviseur: 'Superviseur',
  admin: 'Administrateur',
};

export type FormulairePersonnel = {
  prenom: string;
  nom: string;
  courriel: string;
  motDePasse: string;
  role: RolePersonnel | null;
  /** Équipe à associer tout de suite (employé d'équipe seulement, facultatif). */
  equipeId: string | null;
};

export type ErreursPersonnel = Partial<Record<'prenom' | 'nom' | 'courriel' | 'motDePasse' | 'role', string>>;

export const MESSAGE_REFUS_ADMIN = 'Seul un administrateur peut créer un compte du personnel.';
export const MESSAGE_RESEAU_COMPTE = 'Le serveur ne répond pas. Vérifiez la connexion et réessayez.';
export const MESSAGE_COMPTE_DEJA = 'Un compte existe déjà avec ce courriel.';
export const MESSAGE_MOT_DE_PASSE_FAIBLE = `Mot de passe trop faible : au moins ${MOT_DE_PASSE_MIN} caractères, avec des lettres et des chiffres.`;

/** Corrections à faire avant l'envoi, champ par champ (vide si tout est bon). */
export function validerPersonnel(f: FormulairePersonnel): ErreursPersonnel {
  const e: ErreursPersonnel = {};
  if (f.prenom.trim().length < 1) e.prenom = 'Entrez le prénom.';
  if (f.nom.trim().length < 1) e.nom = 'Entrez le nom.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.courriel.trim())) e.courriel = 'Entrez un courriel valide, par exemple nom@ville.ca.';
  if (f.motDePasse.length < MOT_DE_PASSE_MIN) e.motDePasse = `Le mot de passe provisoire doit avoir au moins ${MOT_DE_PASSE_MIN} caractères.`;
  if (!f.role) e.role = 'Choisissez un rôle.';
  return e;
}

/** Corps de la demande selon le rôle choisi : équipe = employé commis, superviseur = employé superviseur, admin = admin. */
export function utilisateurDuFormulaire(f: FormulairePersonnel & { role: RolePersonnel }): NouvelUtilisateur {
  const base = { email: f.courriel.trim(), motDePasse: f.motDePasse, prenom: f.prenom.trim(), nom: f.nom.trim() };
  if (f.role === 'admin') return { role: 'admin', ...base };
  return { role: 'employe', poste: f.role === 'superviseur' ? 'superviseur' : 'commis', ...base };
}

export type ResultatCreation =
  | { ok: true; role: RolePersonnel; courriel: string; avertissement: string | null }
  | { ok: false; erreurs: ErreursPersonnel; message: string | null };

/** Erreur du serveur en français, reliée au champ concerné quand c'est possible. */
export function erreurCreation(e: unknown): { erreurs: ErreursPersonnel; message: string | null } {
  const erreur = e instanceof ErreurAuth ? e : null;
  const code = erreur?.code;
  const texte = (erreur?.message ?? (e instanceof Error ? e.message : '')).toLowerCase();
  if (code === 401 || code === 403) return { erreurs: {}, message: MESSAGE_REFUS_ADMIN };
  if (code === 409 || code === 'user_already_exists' || code === 'email_exists' || /existe|already|exists|registered/.test(texte)) {
    return { erreurs: { courriel: MESSAGE_COMPTE_DEJA }, message: null };
  }
  if (code === 'weak_password' || /faible|weak|password|mot de passe/.test(texte)) return { erreurs: { motDePasse: MESSAGE_MOT_DE_PASSE_FAIBLE }, message: null };
  if (/invalid|invalide|email/.test(texte) && /mail|courriel/.test(texte)) return { erreurs: { courriel: 'Ce courriel n’est pas valide.' }, message: null };
  if (/injoignable|network|fetch|serveur|indisponible/.test(texte)) return { erreurs: {}, message: MESSAGE_RESEAU_COMPTE };
  return { erreurs: {}, message: 'Le compte n’a pas pu être créé. Réessayez dans un moment.' };
}

/**
 * Crée le compte (réservé aux administrateurs, vérifié par le serveur), puis associe l'équipe si elle est choisie.
 * Le mot de passe n'est ni gardé ni journalisé : il ne sert qu'à cet appel.
 */
export async function creerComptePersonnel(f: FormulairePersonnel): Promise<ResultatCreation> {
  const erreurs = validerPersonnel(f);
  if (Object.keys(erreurs).length > 0 || !f.role) return { ok: false, erreurs, message: null };
  try {
    await creerUtilisateur(utilisateurDuFormulaire({ ...f, role: f.role }));
  } catch (e) {
    return { ok: false, ...erreurCreation(e) };
  }
  let avertissement: string | null = null;
  if (f.role === 'equipe' && f.equipeId) {
    const refus = await associerCompte(f.courriel, f.equipeId);
    if (refus) avertissement = `Le compte est créé, mais l'équipe n'a pas pu être associée : ${refus}`;
  }
  return { ok: true, role: f.role, courriel: f.courriel.trim(), avertissement };
}
