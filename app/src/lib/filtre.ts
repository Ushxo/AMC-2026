import type { Categorie, Etat, Signalement } from '../types';

export type FiltreSignalements = { etats?: Etat[]; categories?: Categorie[] };

export function filtrerSignalements(liste: Signalement[], filtre?: FiltreSignalements): Signalement[] {
  if (!filtre) return liste;
  const { etats, categories } = filtre;
  return liste.filter(
    (s) =>
      (!etats || etats.length === 0 || etats.includes(s.etat)) &&
      (!categories || categories.length === 0 || categories.includes(s.categorie)),
  );
}
