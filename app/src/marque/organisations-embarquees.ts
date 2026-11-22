// Les organisations (marques) : types et les deux marques embarquées. Sans dépendance (ni réseau, ni stockage).

/** Les jetons de couleur que l'organisation peut régler (mêmes noms que la palette de l'interface). */
export const CLES_COULEURS = [
  'text',
  'textSecondary',
  'background',
  'backgroundElement',
  'backgroundSelected',
  'primary',
  'onPrimary',
  'accent',
  'accentDoux',
  'action',
  'onAction',
  'header',
  'onHeader',
  'surface',
  'border',
  'borderForte',
  'success',
  'danger',
] as const;
export type CleCouleur = (typeof CLES_COULEURS)[number];
export type Couleurs = Record<CleCouleur, string>;

/** Logos embarqués dans l'app (la base ne garde que la clé : l'app marche sans réseau). */
export type CleLogo = 'priorix' | 'fleur';
export const CLES_LOGO: CleLogo[] = ['priorix', 'fleur'];

export type Organisation = {
  /** Absent pour les marques embarquées pas encore lues en base. */
  id?: string;
  code: string;
  nom: string;
  nom_app: string;
  slogan: string | null;
  logo: string;
  couleurs: Partial<Couleurs>;
};

const COULEURS_PRIORIX: Couleurs = {
  text: '#2A1D14',
  textSecondary: '#5F665C',
  background: '#F5F3ED',
  backgroundElement: '#EEF2EA',
  backgroundSelected: '#C6D2C0',
  primary: '#1D3A1B',
  onPrimary: '#FFFFFF',
  accent: '#EE5F12',
  accentDoux: '#F28A33',
  action: '#B84A0B',
  onAction: '#FFFFFF',
  header: '#1D3A1B',
  onHeader: '#F8F4EA',
  surface: '#FFFFFF',
  border: '#D8E0D2',
  borderForte: '#7F8A7B',
  success: '#4F7A57',
  danger: '#B3261E',
};

const COULEURS_MONTREAL: Couleurs = {
  text: '#1F1A1A',
  textSecondary: '#5E5557',
  background: '#FBF8F8',
  backgroundElement: '#F6E9EA',
  backgroundSelected: '#F2CED1',
  primary: '#B5121B',
  onPrimary: '#FFFFFF',
  accent: '#B5121B',
  accentDoux: '#D8343C',
  action: '#8F0E15',
  onAction: '#FFFFFF',
  header: '#B5121B',
  onHeader: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E8D5D7',
  borderForte: '#8A7577',
  success: '#2F6B3A',
  danger: '#8F0E15',
};

/** Les deux marques embarquées : mêmes valeurs que la migration 0009 (repli sans réseau ou sans migration). */
export const ORGANISATIONS_EMBARQUEES: Organisation[] = [
  { code: 'priorix', nom: 'Priorix', nom_app: 'Priorix', slogan: 'Chaque équipe sait par où commencer.', logo: 'priorix', couleurs: COULEURS_PRIORIX },
  { code: 'montreal', nom: 'Ville de Montréal', nom_app: 'Égouts Montréal', slogan: "Signalez, on s'en occupe.", logo: 'fleur', couleurs: COULEURS_MONTREAL },
];
export const CODE_PAR_DEFAUT = 'priorix';

export function organisationEmbarquee(code: string): Organisation | undefined {
  return ORGANISATIONS_EMBARQUEES.find((o) => o.code === code);
}

