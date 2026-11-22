import type { Couleurs } from './organisations-embarquees';

// Variantes d'apparence réglées à la main pour chaque marque embarquée (Sombre, Contraste élevé, Daltonisme).
// Standard = la marque telle quelle. Les autres organisations passent par le calcul automatique (jetons.ts).
export type VarianteMain = 'sombre' | 'contraste' | 'daltonisme';

const PRIORIX: Record<VarianteMain, Partial<Couleurs>> = {
  // Fonds neutres teintés de vert profond, trois niveaux de surface, texte blanc cassé, orange de la marque resté vif.
  sombre: {
    text: '#F3EFE6',
    textSecondary: '#B7C0B2',
    background: '#111A12',
    surface: '#18241A',
    backgroundElement: '#213323',
    backgroundSelected: '#2F4631',
    primary: '#A6D49A',
    onPrimary: '#0E180F',
    accent: '#FF7A2E',
    accentDoux: '#F5A05C',
    action: '#E8651A',
    onAction: '#1A0C04',
    header: '#0B130C',
    onHeader: '#F3EFE6',
    border: '#2A3C2C',
    borderForte: '#7A8F78',
    success: '#86CF92',
    danger: '#FF8F86',
  },
  // Blanc pur, texte noir, vert forêt et orange assombris, contours marqués.
  contraste: {
    text: '#000000',
    textSecondary: '#2B2B2B',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    backgroundElement: '#F0F4EE',
    backgroundSelected: '#D3E2CE',
    primary: '#0F2A0E',
    onPrimary: '#FFFFFF',
    accent: '#B33A00',
    accentDoux: '#CC5200',
    action: '#8A3300',
    onAction: '#FFFFFF',
    header: '#0F2A0E',
    onHeader: '#FFFFFF',
    border: '#1F1F1F',
    borderForte: '#000000',
    success: '#1B5E20',
    danger: '#A30000',
  },
  // Bleu et ambre à la place du vert et du rouge : l'identité (vert forêt, orange) reste sur l'en-tête et l'action.
  daltonisme: {
    success: '#005A9C',
    danger: '#962F00',
    accent: '#9C5700',
    accentDoux: '#E69F00',
  },
};

const MONTREAL: Record<VarianteMain, Partial<Couleurs>> = {
  sombre: {
    text: '#F6F1F1',
    textSecondary: '#C0B3B5',
    background: '#151011',
    surface: '#1E1617',
    backgroundElement: '#2A1F21',
    backgroundSelected: '#40292C',
    primary: '#FF8A90',
    onPrimary: '#1A0507',
    accent: '#F0535B',
    accentDoux: '#FF8A90',
    action: '#D2303A',
    onAction: '#FFFFFF',
    header: '#8F0E15',
    onHeader: '#FFFFFF',
    border: '#38292B',
    borderForte: '#8F7D80',
    success: '#7ED79A',
    danger: '#FF9B9B',
  },
  contraste: {
    text: '#000000',
    textSecondary: '#363636',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    backgroundElement: '#F9EDED',
    backgroundSelected: '#F0C9CC',
    primary: '#8F0A12',
    onPrimary: '#FFFFFF',
    accent: '#A00F17',
    accentDoux: '#C8222B',
    action: '#6F0A10',
    onAction: '#FFFFFF',
    header: '#8F0A12',
    onHeader: '#FFFFFF',
    border: '#2E2E2E',
    borderForte: '#000000',
    success: '#1B5E20',
    danger: '#B00020',
  },
  daltonisme: {
    success: '#005A9C',
    danger: '#8A3B00',
    accent: '#9C5700',
    accentDoux: '#E69F00',
  },
};

export const APPARENCES_MAIN: Record<string, Record<VarianteMain, Partial<Couleurs>>> = {
  priorix: PRIORIX,
  montreal: MONTREAL,
};
