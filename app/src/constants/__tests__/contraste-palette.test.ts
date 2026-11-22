import { Palette } from '../theme';

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('contraste de la palette (WCAG)', () => {
  it('texte courant et texte secondaire lisibles sur le fond crème et sur les cartes (4,5 pour 1)', () => {
    expect(ratio(Palette.text, Palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.textSecondary, Palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.textSecondary, Palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.text, Palette.backgroundElement)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.text, Palette.backgroundSelected)).toBeGreaterThanOrEqual(4.5);
  });

  it('boutons pleins, en-têtes et onglets actifs (4,5 pour 1)', () => {
    expect(ratio(Palette.onPrimary, Palette.primary)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.onHeader, Palette.header)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.header, Palette.backgroundSelected)).toBeGreaterThanOrEqual(4.5); // texte des onglets sur la pastille sauge
    expect(ratio(Palette.header, Palette.onHeader)).toBeGreaterThanOrEqual(4.5); // texte des onglets sur la barre
  });

  it('contour d’un champ de saisie : 3 pour 1 sur le fond crème (composants d’interface)', () => {
    expect(ratio(Palette.borderForte, Palette.onHeader)).toBeGreaterThanOrEqual(3);
    expect(ratio(Palette.borderForte, Palette.surface)).toBeGreaterThanOrEqual(3);
  });

  it('étiquettes d’état : vert forêt sur orange pâle, danger sur orange pâle (4,5 pour 1)', () => {
    expect(ratio(Palette.header, '#FBDCC4')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(Palette.danger, '#FBDCC4')).toBeGreaterThanOrEqual(4.5);
  });

  it('gros texte en blanc sur l’orange du bouton de connexion : 3 pour 1 (texte de 19 points en gras)', () => {
    expect(ratio(Palette.surface, Palette.accent)).toBeGreaterThanOrEqual(3);
  });
});
