import { CATEGORIES_TOUTES, type Categorie, type Etat, type ResumeVille, type Signalement } from '../types';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];
const CATEGORIES: Categorie[] = CATEGORIES_TOUTES;

export function calculerResume(signalements: Signalement[]): ResumeVille {
  const parEtat = Object.fromEntries(ETATS.map((e) => [e, 0])) as Record<Etat, number>;
  const parCategorie = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Categorie, number>;
  for (const s of signalements) {
    parEtat[s.etat] += 1;
    parCategorie[s.categorie] += 1;
  }
  return { parEtat, parCategorie };
}
