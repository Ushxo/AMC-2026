import type { Gravite } from '@/types';

export const COULEUR_GRAVITE: Record<Gravite, string> = {
  faible: '#1B7F4B',
  moyenne: '#A85A00',
  elevee: '#B3261E',
};

export const COULEUR_ACCENT = '#1F5FBF';
export const CIBLE_MIN = 48;

/** Couleurs de texte avec contraste suffisant en clair et en sombre. */
export const COULEURS_TEXTE = {
  light: { erreur: '#B3261E', lien: '#1F5FBF' },
  dark: { erreur: '#FF8A80', lien: '#8AB4F8' },
} as const;

/** Une couleur par équipe, lisible sur fond clair et sombre et distincte pour le daltonisme (palette Okabe-Ito). */
export const COULEURS_EQUIPES = [
  '#0072B2',
  '#D55E00',
  '#009E73',
  '#CC79A7',
  '#E69F00',
  '#56B4E9',
  '#F0E442',
  '#000000',
] as const;

export function couleurEquipe(index: number): string {
  return COULEURS_EQUIPES[((index % COULEURS_EQUIPES.length) + COULEURS_EQUIPES.length) % COULEURS_EQUIPES.length];
}

export const COULEUR_INCIDENT = '#B3261E';
export const FOND_INCIDENT = 'rgba(179, 38, 30, 0.25)';

/** Texte posé sur un repère de gravité (coche). */
export const COULEUR_SUR_REPERE = '#FFFFFF';

/** Liserés d'un repère de carte : lisible sur fond clair comme sur fond sombre. */
export const LISERE_CLAIR = '#FFFFFF';
export const LISERE_SOMBRE = '#111318';
/** Repère d'un arrêt déjà fait. */
export const COULEUR_ARRET_FAIT = '#7B8580';

/** Couleurs des repères de bouche d'égout (fournies avec le dessin) : le niveau reste aussi dit en texte. */
export const COULEUR_REPERE: Record<Gravite | 'existant', string> = {
  existant: '#7B8580',
  faible: '#2F7D32',
  moyenne: '#F47B20',
  elevee: '#D9363E',
};
