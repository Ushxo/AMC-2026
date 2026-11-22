import { contrasteAvecBlanc, COULEUR_REPERE, couleurSigne, LISERE_CLAIR, LISERE_SOMBRE } from '../style';

describe('signe sur les repères (contraste)', () => {
  it('blanc sur le orange moyen : sous 3 pour 1, donc signe foncé', () => {
    expect(contrasteAvecBlanc(COULEUR_REPERE.moyenne)).toBeLessThan(3);
    expect(couleurSigne(COULEUR_REPERE.moyenne)).toBe(LISERE_SOMBRE);
  });
  it('blanc gardé sur le vert, le rouge et le bleu des arrêts', () => {
    for (const c of [COULEUR_REPERE.faible, COULEUR_REPERE.elevee, '#0072B2']) {
      expect(contrasteAvecBlanc(c)).toBeGreaterThanOrEqual(3);
      expect(couleurSigne(c)).toBe(LISERE_CLAIR);
    }
  });
  it('le signe foncé sur le orange dépasse 4,5 pour 1', () => {
    // contraste du #111318 sur #F47B20, calculé comme le blanc : (L + 0,05) / (Lsombre + 0,05)
    const canal = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const lum = (r: number, g: number, b: number) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const orange = lum(0xf4, 0x7b, 0x20);
    const sombre = lum(0x11, 0x13, 0x18);
    expect((orange + 0.05) / (sombre + 0.05)).toBeGreaterThan(4.5);
  });
});
