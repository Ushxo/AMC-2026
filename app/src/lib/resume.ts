import type { Categorie, Etat, ResumeVille, Signalement } from '../types';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];
const CATEGORIES: Categorie[] = [
  'grille_bouchee',
  'eau_accumulee',
  'eau_douteuse',
  'absence_eau',
  'autre',
];

export function calculerResume(signalements: Signalement[]): ResumeVille {
  const parEtat = Object.fromEntries(ETATS.map((e) => [e, 0])) as Record<Etat, number>;
  const parCategorie = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Categorie, number>;
  for (const s of signalements) {
    parEtat[s.etat] += 1;
    parCategorie[s.categorie] += 1;
  }
  return { parEtat, parCategorie };
}
