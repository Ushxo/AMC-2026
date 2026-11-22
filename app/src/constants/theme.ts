/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Jetons de couleur de l'interface : la palette du coéquipier (vert forêt, crème, sauge, orange).
 * Les écrans n'écrivent jamais une couleur : ils lisent useTheme() (ou Palette hors d'un composant).
 * Les couleurs des repères de carte (gravité) et des équipes restent dans components/ville/style.ts.
 */
export const Colors = {
  light: {
    text: '#2A1D14',
    background: '#F5F3ED',
    backgroundElement: '#EEF2EA',
    backgroundSelected: '#C6D2C0',
    textSecondary: '#5F665C',
    /** Fond des boutons pleins et des bandeaux : vert forêt, texte blanc (contraste 12 pour 1). */
    primary: '#1D3A1B',
    onPrimary: '#FFFFFF',
    /** Orange : accent (pastilles, repères d'action), jamais un fond de texte courant. */
    accent: '#EE5F12',
    accentDoux: '#F28A33',
    /** Fond des en-têtes de la coquille (même vert que primary, plus profond en sombre). */
    header: '#1D3A1B',
    onHeader: '#F8F4EA',
    surface: '#FFFFFF',
    border: '#D8E0D2',
    /** Contour d'un champ de saisie : 3 pour 1 au moins sur le fond crème (contraste des composants). */
    borderForte: '#7F8A7B',
    success: '#4F7A57',
    danger: '#B3261E',
  },
  dark: {
    text: '#F5F3ED',
    background: '#161C15',
    backgroundElement: '#212B20',
    backgroundSelected: '#31412F',
    textSecondary: '#B8C2B4',
    primary: '#4F7A57',
    onPrimary: '#FFFFFF',
    accent: '#F28A33',
    accentDoux: '#F28A33',
    header: '#0F140F',
    onHeader: '#F8F4EA',
    surface: '#212B20',
    border: '#31412F',
    borderForte: '#7F8A7B',
    success: '#7FB48A',
    danger: '#FF8A80',
  },
} as const;

/** Palette claire pour le code hors composant (styles figés des écrans du coéquipier). */
export const Palette = Colors.light;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Polices de l'interface : une famille par graisse (Montserrat). Le texte courant est en 500 ; les titres en 700 ou 800. */
export const Polices = {
  normal: 'Montserrat_400Regular',
  moyenne: 'Montserrat_500Medium',
  semi: 'Montserrat_600SemiBold',
  grasse: 'Montserrat_700Bold',
  extra: 'Montserrat_800ExtraBold',
} as const;

/** Famille qui correspond à une graisse CSS (« 700 », « bold », 800…). Sans graisse : texte courant, 500. */
export function famillePolice(graisse?: string | number): string {
  const n = graisse === 'bold' ? 700 : graisse === 'normal' || graisse === undefined ? 0 : Number(graisse);
  if (n >= 800) return Polices.extra;
  if (n >= 700) return Polices.grasse;
  if (n >= 600) return Polices.semi;
  if (n >= 400 && n < 500 && graisse !== undefined && graisse !== 'normal') return Polices.normal;
  return Polices.moyenne;
}
