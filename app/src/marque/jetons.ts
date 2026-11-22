import { CLES_COULEURS, type Couleurs, type CleCouleur } from './organisations-embarquees';

import { ajusterContraste, assombrir, contraste, eclaircir, estCouleurHex, luminance, melanger, texteSur } from './couleurs';

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

/** Vrai pour une palette à fond sombre (thème Nuit, ou une marque sombre). */
export function estSombre(c: Couleurs): boolean {
  return luminance(c.background) < 0.2;
}

/** Les deux réglages de lisibilité, par-dessus n'importe quel thème. */
export type Lisibilite = { contraste: boolean; daltonisme: boolean };
export const LISIBILITE_PAR_DEFAUT: Lisibilite = { contraste: false, daltonisme: false };

/** Contraste élevé : fond noir ou blanc pur, textes et contours renforcés ; l'accent du thème est gardé (assombri ou éclairci au besoin). */
export function renforcerContraste(base: Couleurs): Couleurs {
  const sombre = estSombre(base);
  const fond = sombre ? '#000000' : '#FFFFFF';
  const c: Couleurs = { ...base, background: fond, surface: sombre ? '#0A0A0A' : '#FFFFFF', text: sombre ? '#FFFFFF' : '#000000' };
  c.backgroundElement = melanger(fond, base.primary, sombre ? 0.14 : 0.08);
  c.backgroundSelected = melanger(fond, base.primary, sombre ? 0.34 : 0.22);
  c.textSecondary = ajusterContraste(ajusterContraste(base.textSecondary, c.backgroundSelected, 7), fond, 7);
  c.primary = ajusterContraste(ajusterContraste(base.primary, c.backgroundSelected, 7), fond, 7);
  c.onPrimary = texteSur(c.primary);
  c.action = sombre ? base.action : ajusterContraste(base.action, fond, 7);
  c.onAction = texteSur(c.action);
  c.accent = ajusterContraste(ajusterContraste(base.accent, c.backgroundSelected, 4.5), fond, 4.5);
  c.accentDoux = ajusterContraste(base.accentDoux, fond, 3);
  c.header = sombre ? '#000000' : ajusterContraste(base.header, fond, 7);
  c.onHeader = texteSur(c.header);
  c.border = sombre ? '#BDBDBD' : '#3A3A3A';
  c.borderForte = c.text;
  c.success = ajusterContraste(ajusterContraste(base.success, c.backgroundSelected, 7), fond, 7);
  c.danger = ajusterContraste(ajusterContraste(base.danger, c.backgroundSelected, 7), fond, 7);
  return c;
}

/** Adapté au daltonisme : le succès et le danger ne reposent plus sur le vert et le rouge (bleu et vermillon). Les mots restent écrits partout. */
export function adapterDaltonisme(base: Couleurs): Couleurs {
  const sombre = estSombre(base);
  const c: Couleurs = { ...base };
  const sur = [base.background, base.surface, base.backgroundElement, base.backgroundSelected];
  const regler = (couleur: string, min: number) => sur.reduce((acc, f) => ajusterContraste(acc, f, min), couleur);
  c.success = regler(sombre ? '#56B4E9' : '#0072B2', 4.5);
  c.danger = regler(sombre ? '#FF9A5C' : '#B34100', 4.5);
  c.accent = regler(sombre ? '#E69F00' : '#9C5700', 3);
  return c;
}

/** Palette finale : la base du thème, puis le contraste élevé, puis le daltonisme s'ils sont activés. */
export function couleursAvecLisibilite(base: Couleurs, l: Lisibilite): Couleurs {
  let c = base;
  if (l.contraste) c = renforcerContraste(c);
  if (l.daltonisme) c = adapterDaltonisme(c);
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
