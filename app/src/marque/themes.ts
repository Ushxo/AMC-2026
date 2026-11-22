import type { Couleurs } from './organisations-embarquees';

/**
 * Les thèmes : des palettes de couleurs distinctes, réglées à la main (les 18 jetons de chacune).
 * « organisation » n'a pas de palette ici : c'est la marque de l'organisation (Priorix, Ville de Montréal…), toujours en premier.
 * Le logo et le nom de l'organisation ne changent jamais avec le thème.
 */
export type ThemeId = 'organisation' | 'ocean' | 'ardoise' | 'terre-cuite' | 'prune' | 'nuit';

export const THEME_ORGANISATION: ThemeId = 'organisation';

export const THEMES_IDS: ThemeId[] = ['organisation', 'ocean', 'ardoise', 'terre-cuite', 'prune', 'nuit'];

export const LIBELLES_THEME_APP: Record<ThemeId, string> = {
  organisation: "Thème de l'organisation",
  ocean: 'Océan',
  ardoise: 'Ardoise',
  'terre-cuite': 'Terre cuite',
  prune: 'Prune',
  nuit: 'Nuit',
};

/** Palettes des thèmes (hors organisation). */
export const PALETTES: Record<Exclude<ThemeId, 'organisation'>, Couleurs> = {
  // Bleus profonds, sable clair, accent corail.
  ocean: {
    text: '#10222E',
    textSecondary: '#44596A',
    background: '#F1F6F9',
    backgroundElement: '#E3EDF3',
    backgroundSelected: '#C5DAE8',
    primary: '#0B4F7C',
    onPrimary: '#FFFFFF',
    accent: '#E0583F',
    accentDoux: '#F28B7B',
    action: '#C4402A',
    onAction: '#FFFFFF',
    header: '#0B3A5C',
    onHeader: '#F1F6F9',
    surface: '#FFFFFF',
    border: '#D0DFEA',
    borderForte: '#6A8498',
    success: '#2A7A57',
    danger: '#B3261E',
  },
  // Gris bleutés, accent indigo vif.
  ardoise: {
    text: '#1B2330',
    textSecondary: '#4F5B6E',
    background: '#F2F4F8',
    backgroundElement: '#E6EAF1',
    backgroundSelected: '#CBD4E3',
    primary: '#34445C',
    onPrimary: '#FFFFFF',
    accent: '#5B5BD6',
    accentDoux: '#9A9AF2',
    action: '#4A43D8',
    onAction: '#FFFFFF',
    header: '#2A3649',
    onHeader: '#F2F4F8',
    surface: '#FFFFFF',
    border: '#D8DEE8',
    borderForte: '#76849A',
    success: '#2D7A4D',
    danger: '#B3261E',
  },
  // Tons chauds : argile, crème, brique.
  'terre-cuite': {
    text: '#2E1D14',
    textSecondary: '#634E40',
    background: '#FBF3EA',
    backgroundElement: '#F5E6D6',
    backgroundSelected: '#E9CDB0',
    primary: '#8E3B1F',
    onPrimary: '#FFFFFF',
    accent: '#D2691E',
    accentDoux: '#E4955E',
    action: '#A5401A',
    onAction: '#FFFFFF',
    header: '#7A3318',
    onHeader: '#FFF3E6',
    surface: '#FFFFFF',
    border: '#EAD8C4',
    borderForte: '#8F7460',
    success: '#3C7544',
    danger: '#B3261E',
  },
  // Violet profond, accent magenta.
  prune: {
    text: '#25152F',
    textSecondary: '#5A4669',
    background: '#F8F3FB',
    backgroundElement: '#EEE4F5',
    backgroundSelected: '#D8C4E8',
    primary: '#5B2A86',
    onPrimary: '#FFFFFF',
    accent: '#D0348A',
    accentDoux: '#E27AB8',
    action: '#A3236F',
    onAction: '#FFFFFF',
    header: '#4A2170',
    onHeader: '#F8F3FB',
    surface: '#FFFFFF',
    border: '#E3D5EE',
    borderForte: '#80689A',
    success: '#2D7A4D',
    danger: '#B3261E',
  },
  // Un vrai thème sombre : fonds bleu-noir étagés, texte blanc cassé, accent ambre.
  nuit: {
    text: '#EEF2F7',
    textSecondary: '#A9B4C4',
    background: '#0F141C',
    backgroundElement: '#1C2431',
    backgroundSelected: '#2B3950',
    primary: '#86B6FF',
    onPrimary: '#0A1424',
    accent: '#FFB454',
    accentDoux: '#FFCE8A',
    action: '#F59E42',
    onAction: '#1A1004',
    header: '#0A0F16',
    onHeader: '#EEF2F7',
    surface: '#161D28',
    border: '#263143',
    borderForte: '#6B7C94',
    success: '#6FD39A',
    danger: '#FF9090',
  },
};

export function estThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEMES_IDS as string[]).includes(v);
}
