import { CLES_COULEURS, type Couleurs, type CleCouleur } from './organisations-embarquees';

import { ajusterContraste, assombrir, contraste, eclaircir, estCouleurHex, melanger, texteSur } from './couleurs';

export type { Couleurs, CleCouleur };

/** Les jetons que lisent tous les écrans : les couleurs de la marque, plus quelques teintes calculées à partir d'elles. */
export type Jetons = Couleurs & {
  /** Fond des bandeaux d'information (vert pâle chez Priorix). */
  bandeau: string;
  /** Texte sur un bandeau. */
  onBandeau: string;
  /** Texte secondaire sur l'en-tête (sous-titres). */
  onHeaderSoft: string;
  /** Fond doux de la couleur d'action (étiquettes, pastilles). */
  actionDoux: string;
  /** Texte sur le fond doux de l'action. */
  onActionDoux: string;
};

export type Apparence = 'standard' | 'contraste' | 'sombre';
export const APPARENCES: Apparence[] = ['standard', 'contraste', 'sombre'];
export const LIBELLES_APPARENCE: Record<Apparence, string> = {
  standard: 'Standard',
  contraste: 'Contraste élevé',
  sombre: 'Sombre',
};

/** Complète une palette partielle avec celle de repli, jeton par jeton. */
export function completerCouleurs(partielle: Partial<Couleurs> | undefined, repli: Couleurs): Couleurs {
  const out = { ...repli };
  for (const k of CLES_COULEURS) {
    const v = partielle?.[k];
    if (estCouleurHex(v)) out[k] = v.toUpperCase();
  }
  return out;
}

/** Les jetons dérivés : calculés pour que toute marque garde des bandeaux et sous-titres lisibles. */
export function jetonsDepuis(c: Couleurs): Jetons {
  const bandeau = melanger(c.backgroundSelected, c.surface, 0.5);
  const actionDoux = melanger(c.action, c.surface, 0.88);
  return {
    ...c,
    bandeau,
    onBandeau: ajusterContraste(c.primary, bandeau, 4.5),
    onHeaderSoft: ajusterContraste(melanger(c.onHeader, c.header, 0.2), c.header, 4.5),
    actionDoux,
    onActionDoux: ajusterContraste(assombrir(c.action, 0.4), actionDoux, 4.5),
  };
}

/** Variante d'apparence appliquée à la palette de la marque. */
export function appliquerApparence(base: Couleurs, apparence: Apparence): Couleurs {
  if (apparence === 'standard') return base;

  if (apparence === 'contraste') {
    const fond = '#FFFFFF';
    const c: Couleurs = { ...base, background: fond, surface: fond, text: '#000000' };
    c.textSecondary = ajusterContraste(base.textSecondary, fond, 7);
    c.primary = ajusterContraste(base.primary, fond, 7);
    c.onPrimary = texteSur(c.primary);
    c.action = ajusterContraste(base.action, fond, 7);
    c.onAction = texteSur(c.action);
    c.accent = ajusterContraste(base.accent, fond, 4.5);
    c.accentDoux = ajusterContraste(base.accentDoux, fond, 3);
    c.header = ajusterContraste(base.header, fond, 7);
    c.onHeader = texteSur(c.header);
    c.backgroundElement = melanger(fond, c.primary, 0.08);
    c.backgroundSelected = melanger(fond, c.primary, 0.22);
    c.border = '#3A3A3A';
    c.borderForte = '#000000';
    c.success = ajusterContraste(base.success, fond, 7);
    c.danger = ajusterContraste(base.danger, fond, 7);
    return c;
  }

  // Sombre : fonds très foncés teintés par la couleur principale de la marque, couleurs vives éclaircies pour rester lisibles.
  const fond = melanger(base.primary, '#000000', 0.9);
  const surface = melanger(base.primary, '#000000', 0.8);
  const c: Couleurs = { ...base, background: fond, surface, text: '#F5F3ED' };
  c.backgroundElement = melanger(base.primary, '#000000', 0.74);
  c.backgroundSelected = melanger(base.primary, '#000000', 0.55);
  c.textSecondary = ajusterContraste(melanger('#F5F3ED', fond, 0.3), fond, 4.5);
  c.primary = ajusterContraste(eclaircir(base.primary, 0.3), surface, 4.5);
  c.onPrimary = texteSur(c.primary);
  c.action = ajusterContraste(eclaircir(base.action, 0.15), fond, 4.5);
  c.onAction = texteSur(c.action);
  c.accent = ajusterContraste(eclaircir(base.accent, 0.2), fond, 4.5);
  c.accentDoux = eclaircir(base.accentDoux, 0.1);
  c.header = melanger(base.header, '#000000', 0.55);
  c.onHeader = texteSur(c.header);
  c.border = melanger(base.primary, '#000000', 0.55);
  c.borderForte = ajusterContraste(melanger('#F5F3ED', fond, 0.45), fond, 3);
  c.success = ajusterContraste(eclaircir(base.success, 0.35), fond, 4.5);
  c.danger = ajusterContraste(eclaircir(base.danger, 0.4), fond, 4.5);
  return c;
}

export type ProblemeContraste = { jeton: string; contre: string; rapport: number; min: number };

/** Les couples de couleurs illisibles d'une palette (texte sur fond, en dessous du minimum WCAG). */
export function problemesContraste(c: Couleurs): ProblemeContraste[] {
  const couples: [CleCouleur, CleCouleur, number][] = [
    ['onPrimary', 'primary', 4.5],
    ['onAction', 'action', 4.5],
    ['onHeader', 'header', 4.5],
    ['text', 'background', 4.5],
    ['text', 'surface', 4.5],
    ['textSecondary', 'background', 4.5],
    ['textSecondary', 'surface', 4.5],
  ];
  return couples
    .map(([jeton, contre, min]) => ({ jeton, contre, min, rapport: contraste(c[jeton], c[contre]) }))
    .filter((p) => p.rapport < p.min);
}

/** Corrige les couples illisibles : les textes sur couleur pleine reprennent noir ou blanc, les textes secondaires s'assombrissent. */
export function corrigerContraste(c: Couleurs): Couleurs {
  const out = { ...c };
  if (contraste(out.onPrimary, out.primary) < 4.5) out.onPrimary = texteSur(out.primary);
  if (contraste(out.onAction, out.action) < 4.5) out.onAction = texteSur(out.action);
  if (contraste(out.onHeader, out.header) < 4.5) out.onHeader = texteSur(out.header);
  if (contraste(out.text, out.background) < 4.5) out.text = ajusterContraste(out.text, out.background, 7);
  if (contraste(out.text, out.surface) < 4.5) out.text = ajusterContraste(out.text, out.surface, 7);
  if (contraste(out.textSecondary, out.background) < 4.5) out.textSecondary = ajusterContraste(out.textSecondary, out.background, 4.5);
  if (contraste(out.textSecondary, out.surface) < 4.5) out.textSecondary = ajusterContraste(out.textSecondary, out.surface, 4.5);
  return out;
}

export type Graines = { primary: string; action: string; header: string; background: string };

/**
 * Palette complète à partir de quatre couleurs principales (primaire, action, en-tête, fond) : le reste en découle
 * (textes sur couleur, teintes de fond, bordures) et les couples illisibles sont corrigés.
 */
export function paletteDepuisGraines(graines: Graines, base: Couleurs): Couleurs {
  const { primary, action, header, background } = graines;
  const c: Couleurs = {
    ...base,
    primary,
    action,
    header,
    background,
    accent: action,
    accentDoux: eclaircir(action, 0.3),
    onPrimary: texteSur(primary),
    onAction: texteSur(action),
    onHeader: texteSur(header),
    backgroundElement: melanger(background, primary, 0.07),
    backgroundSelected: melanger(background, primary, 0.24),
    border: melanger(background, primary, 0.16),
    borderForte: ajusterContraste(melanger(background, primary, 0.5), background, 3),
    surface: melanger(background, '#FFFFFF', 0.7),
  };
  c.text = ajusterContraste(melanger(primary, '#000000', 0.8), background, 7);
  c.textSecondary = ajusterContraste(melanger(c.text, background, 0.35), background, 4.5);
  return corrigerContraste(c);
}

/** Préréglages proposés à l'administrateur (quatre couleurs chacun). */
export const PREREGLAGES: { nom: string; graines: Graines }[] = [
  { nom: 'Vert forêt', graines: { primary: '#1D3A1B', action: '#B84A0B', header: '#1D3A1B', background: '#F5F3ED' } },
  { nom: 'Rouge Montréal', graines: { primary: '#B5121B', action: '#8F0E15', header: '#B5121B', background: '#FBF8F8' } },
  { nom: 'Bleu fleuve', graines: { primary: '#0F4C81', action: '#A8460A', header: '#0F4C81', background: '#F3F7FB' } },
  { nom: 'Prune', graines: { primary: '#5B2A86', action: '#9C3D00', header: '#5B2A86', background: '#F8F5FB' } },
  { nom: 'Ardoise', graines: { primary: '#2F3E4E', action: '#B0390A', header: '#2F3E4E', background: '#F4F6F8' } },
  { nom: 'Sable', graines: { primary: '#6B4E16', action: '#1F5E23', header: '#6B4E16', background: '#FAF6EC' } },
];
