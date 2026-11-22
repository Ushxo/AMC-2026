import { screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { contraste } from '../../src/marque/couleurs';
import { definirLisibilite, definirTheme, lireMarque } from '../../src/marque/magasin';
import { THEMES_IDS, type ThemeId } from '../../src/marque/themes';

type Style = Record<string, unknown>;

function aplatir(style: unknown): Style {
  if (Array.isArray(style)) return style.reduce<Style>((a, s) => ({ ...a, ...aplatir(s) }), {});
  return style && typeof style === 'object' ? (style as Style) : {};
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type Probleme = { texte: string; couleur: string; fond: string; rapport: number; min: number };

/**
 * Parcourt le rendu : pour chaque texte, sa couleur contre le fond opaque du plus proche ancêtre qui en a un (sinon le fond d'écran du thème).
 * Les fonds translucides (voiles) sont ignorés : on ne juge que des couples opaques, sans deviner un mélange.
 */
function problemes(noeud: ReactTestRendererJSON | ReactTestRendererJSON[] | null, fondEcran: string, fond: string = fondEcran, sortie: Probleme[] = [], ignore = false): Probleme[] {
  if (!noeud) return sortie;
  if (Array.isArray(noeud)) {
    noeud.forEach((n) => problemes(n, fondEcran, fond, sortie, ignore));
    return sortie;
  }
  if (noeud.props?.testID === 'apercu-theme') return sortie; // aperçu d'un autre thème : pas le nôtre
  const st = aplatir(noeud.props?.style);
  const fondCourant = typeof st.backgroundColor === 'string' && HEX.test(st.backgroundColor) ? st.backgroundColor : fond;
  if (noeud.type === 'Text') {
    const couleur = typeof st.color === 'string' && HEX.test(st.color) ? st.color : null;
    const texte = (noeud.children ?? []).filter((c): c is string => typeof c === 'string').join('');
    if (couleur && texte.trim() && st.opacity === undefined) {
      const gros = Number(st.fontSize ?? 14) >= 18 || (Number(st.fontSize ?? 14) >= 14 && Number(st.fontWeight ?? 400) >= 700);
      const min = gros ? 3 : 4.5;
      const rapport = contraste(couleur, fondCourant);
      if (rapport < min) sortie.push({ texte: texte.slice(0, 40), couleur, fond: fondCourant, rapport: Math.round(rapport * 100) / 100, min });
    }
  }
  (noeud.children ?? []).forEach((c) => typeof c !== 'string' && problemes(c, fondEcran, fondCourant, sortie, ignore));
  return sortie;
}

/** Les textes illisibles (couleur contre le fond opaque réel) de l'écran affiché, sous le thème et la lisibilité courants. */
export function textesIllisibles(): Probleme[] {
  return problemes(screen.toJSON(), lireMarque().jetons.background);
}

/** Les combinaisons à vérifier : chaque thème, sans puis avec contraste élevé. */
export const COMBINAISONS_THEMES: [ThemeId, { contraste: boolean; daltonisme: boolean }][] = THEMES_IDS.flatMap((t) =>
  [false, true].map((c) => [t, { contraste: c, daltonisme: false }] as [ThemeId, { contraste: boolean; daltonisme: boolean }]),
);

export function appliquerThemeEtLisibilite(theme: ThemeId, l: { contraste: boolean; daltonisme: boolean }): void {
  definirTheme(theme);
  definirLisibilite(l);
}
