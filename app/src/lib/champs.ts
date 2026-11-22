import { MOT_DE_PASSE_MIN } from './auth';
import { COMMENTAIRE_MAX } from './validation';

/** Erreurs par champ : la clé est le nom du champ, la valeur dit quoi corriger. Rien si tout est bon. */
export type ErreursChamps = Record<string, string>;

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEURE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function minutes(h: string): number {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
}

export function erreursEquipe(c: { nom: string; debut: string; fin: string }): ErreursChamps {
  const e: ErreursChamps = {};
  const nom = c.nom.trim();
  if (nom.length < 1) e.nom = "Entrez le nom de l'équipe.";
  else if (nom.length > 60) e.nom = 'Le nom est trop long (60 caractères au plus).';
  if (!HEURE.test(c.debut.trim())) e.debut = 'Écrivez l’heure ainsi : 07:00.';
  if (!HEURE.test(c.fin.trim())) e.fin = 'Écrivez l’heure ainsi : 14:00.';
  if (!e.debut && !e.fin && minutes(c.fin.trim()) <= minutes(c.debut.trim())) e.fin = 'La fin du quart doit être après son début.';
  return e;
}

export function erreursConnexion(c: { courriel: string; motDePasse: string }): ErreursChamps {
  const e: ErreursChamps = {};
  if (!c.courriel.trim()) e.courriel = 'Entrez votre courriel.';
  else if (!COURRIEL.test(c.courriel.trim())) e.courriel = 'Ce courriel n’est pas valide. Exemple : nom@ville.ca.';
  if (!c.motDePasse) e.motDePasse = 'Entrez votre mot de passe.';
  return e;
}

export function erreursInscription(c: { courriel: string; motDePasse: string }): ErreursChamps {
  const e = erreursConnexion(c);
  if (c.motDePasse && c.motDePasse.length < MOT_DE_PASSE_MIN) e.motDePasse = `Le mot de passe doit avoir ${MOT_DE_PASSE_MIN} caractères au moins.`;
  return e;
}

export function erreursCourrielCompte(courriel: string): ErreursChamps {
  if (!courriel.trim()) return { courriel: "Entrez le courriel du compte de l'équipe." };
  if (!COURRIEL.test(courriel.trim())) return { courriel: 'Ce courriel n’est pas valide. Exemple : nom@ville.ca.' };
  return {};
}

export function erreursSignalement(c: { point: unknown; categorie: unknown; gravite: unknown; commentaire: string }): ErreursChamps {
  const e: ErreursChamps = {};
  if (!c.point) e.lieu = 'Choisissez le lieu : votre position, une adresse ou un point sur la carte.';
  if (!c.categorie) e.categorie = 'Choisissez ce que vous signalez.';
  if (!c.gravite) e.gravite = 'Choisissez la gravité du problème.';
  if (c.commentaire.length > COMMENTAIRE_MAX) e.commentaire = `Le commentaire est trop long (${COMMENTAIRE_MAX} caractères au plus).`;
  return e;
}
