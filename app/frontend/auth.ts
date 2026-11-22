// Connexion de démonstration : le rôle dépend uniquement du courriel.
// Aucun mot de passe n'est vérifié — à remplacer par une vraie authentification (Supabase).
//
//   superviseur@montreal.ca, superviseur.xxx@montreal.ca → Superviseur
//   equipe.a@montreal.ca, equipe.b@…, equipe.c@…        → Employé, responsable de l'Équipe A / B / C
//   tout autre courriel @montreal.ca                    → Employé sans équipe associée
//   tout autre courriel                                 → Citoyen

import { TEAM_IDS } from "./data/mockData";

export type Role = "citoyen" | "employe" | "superviseur";

// team : seulement pour un employé, l'équipe déduite du courriel.
export type Session = { email: string; role: Role; team?: string };

const CITY_DOMAIN = "@montreal.ca";

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function roleForEmail(email: string): Role {
  const value = email.trim().toLowerCase();
  if (!value.endsWith(CITY_DOMAIN)) return "citoyen";
  const local = value.slice(0, -CITY_DOMAIN.length);
  if (local === "superviseur" || local.startsWith("superviseur.")) return "superviseur";
  return "employe";
}

// "equipe.a@montreal.ca" (ou equipe-a, equipea) → "Équipe A", si cette équipe existe.
export function teamForEmail(email: string): string | undefined {
  const value = email.trim().toLowerCase();
  if (!value.endsWith(CITY_DOMAIN)) return undefined;
  const match = value.slice(0, -CITY_DOMAIN.length).match(/^equipe[.\-_]?([a-z])$/);
  if (!match) return undefined;
  const team = `Équipe ${match[1].toUpperCase()}`;
  return TEAM_IDS.includes(team) ? team : undefined;
}

export function sessionForEmail(email: string): Session {
  const clean = email.trim().toLowerCase();
  const role = roleForEmail(clean);
  return role === "employe" ? { email: clean, role, team: teamForEmail(clean) } : { email: clean, role };
}
