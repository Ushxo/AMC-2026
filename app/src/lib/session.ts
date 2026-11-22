import type { Employe } from '../types';

export const ID_EMPLOYE_DEMO = 'demo-hors-ligne';

export type RoleVille = 'employe' | 'superviseur' | 'admin';

let courant: Employe | null = null;
let role: RoleVille | null = null;
let avertissement: string | null = null;
const ecouteurs = new Set<() => void>();

export function employeCourant(): Employe | null {
  return courant;
}

export function definirEmploye(e: Employe | null, nouveauRole: RoleVille | null = null): void {
  courant = e;
  role = e ? (nouveauRole ?? (e.user_id === ID_EMPLOYE_DEMO ? 'superviseur' : 'employe')) : null;
  ecouteurs.forEach((f) => f());
}

export function abonnerEmploye(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

export function estEmployeDemo(e: Employe | null): boolean {
  return e?.user_id === ID_EMPLOYE_DEMO;
}

/** Message à montrer sur l'écran de connexion (session expirée, compte sans accès). */
export function avertissementSession(): string | null {
  return avertissement;
}

export function definirAvertissement(m: string | null): void {
  avertissement = m;
  ecouteurs.forEach((f) => f());
}

/** Rôle effectif de la session. La démonstration hors ligne entre comme superviseur simulé. */
export function roleCourant(): RoleVille | null {
  return role;
}

/** Superviseur ou admin : gère les équipes, lance l'optimisation, ajoute un incident. */
export function peutGerer(r: RoleVille | null): boolean {
  return r === 'superviseur' || r === 'admin';
}

// --- Compte citoyen connecté (inscription publique) ---

export type CitoyenConnecte = { user_id: string; nom: string; courriel: string };

let citoyen: CitoyenConnecte | null = null;

export function citoyenCourant(): CitoyenConnecte | null {
  return citoyen;
}

export function definirCitoyen(c: CitoyenConnecte | null): void {
  citoyen = c;
  ecouteurs.forEach((f) => f());
}
