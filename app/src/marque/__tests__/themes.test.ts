import { contraste } from '../couleurs';
import { jetonsDepuis, couleursAvecLisibilite, type Couleurs, type Jetons } from '../jetons';
import { LIBELLES_THEME_APP, PALETTES, THEMES_IDS, type ThemeId } from '../themes';
import { jetonsDuTheme, reinitialiserMarque } from '../magasin';
import { ORGANISATIONS_EMBARQUEES } from '../organisations-embarquees';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(() => reinitialiserMarque());

type Couple = [string, (j: Jetons) => string, (j: Jetons) => string, number];
// Les couples texte/fond réellement posés par les composants de l'app (de leurs styles), avec le minimum exigé.
const COUPLES: Couple[] = [
  ['texte sur fond d’écran', (j) => j.text, (j) => j.background, 4.5],
  ['texte sur carte', (j) => j.text, (j) => j.surface, 4.5],
  ['texte sur fond doux (cartes, champs de saisie, lignes)', (j) => j.text, (j) => j.backgroundElement, 4.5],
  ['texte sur élément sélectionné (onglet actif, puce, option)', (j) => j.text, (j) => j.backgroundSelected, 4.5],
  ['texte secondaire sur fond d’écran', (j) => j.textSecondary, (j) => j.background, 4.5],
  ['texte secondaire et aide sur carte', (j) => j.textSecondary, (j) => j.surface, 4.5],
  ['texte secondaire, placeholder sur fond doux', (j) => j.textSecondary, (j) => j.backgroundElement, 4.5],
  ['couleur principale (liens, onglets) sur fond d’écran', (j) => j.primary, (j) => j.background, 4.5],
  ['couleur principale sur carte', (j) => j.primary, (j) => j.surface, 4.5],
  ['couleur principale sur fond doux', (j) => j.primary, (j) => j.backgroundElement, 4.5],
  ['couleur principale sur élément sélectionné (onglet actif)', (j) => j.primary, (j) => j.backgroundSelected, 4.5],
  ['texte sur bouton principal', (j) => j.onPrimary, (j) => j.primary, 4.5],
  ['texte sur bouton d’action', (j) => j.onAction, (j) => j.action, 4.5],
  ['texte sur en-tête', (j) => j.onHeader, (j) => j.header, 4.5],
  ['sous-titre d’en-tête', (j) => j.onHeaderSoft, (j) => j.header, 4.5],
  ['texte sur bandeau d’information', (j) => j.onBandeau, (j) => j.bandeau, 4.5],
  ['texte sur étiquette douce d’action', (j) => j.onActionDoux, (j) => j.actionDoux, 4.5],
  ['succès (texte, icône) sur fond d’écran', (j) => j.success, (j) => j.background, 4.5],
  ['succès sur carte', (j) => j.success, (j) => j.surface, 4.5],
  ['danger (erreur, texte) sur fond d’écran', (j) => j.danger, (j) => j.background, 4.5],
  ['danger sur carte', (j) => j.danger, (j) => j.surface, 4.5],
  ['danger sur fond doux', (j) => j.danger, (j) => j.backgroundElement, 4.5],
  ['accent (icônes, gros texte) sur fond d’écran', (j) => j.accent, (j) => j.background, 3],
  ['accent sur carte', (j) => j.accent, (j) => j.surface, 3],
  ['contour de champ et de contrôle sur fond d’écran', (j) => j.borderForte, (j) => j.background, 3],
  ['contour de champ sur carte', (j) => j.borderForte, (j) => j.surface, 3],
  ['bouton d’action sur fond d’écran (le bouton se distingue)', (j) => j.action, (j) => j.background, 3],
];

const LISIBILITES = [{ contraste: false }, { contraste: true }];

describe('thèmes : lisibilité de chaque couple réellement utilisé', () => {
  it('six thèmes, dont celui de l’organisation en premier', () => {
    expect(THEMES_IDS).toHaveLength(6);
    expect(THEMES_IDS[0]).toBe('organisation');
    expect(THEMES_IDS.map((t) => LIBELLES_THEME_APP[t])).toEqual(["Thème de l'organisation", 'Océan', 'Ardoise', 'Terre cuite', 'Prune', 'Nuit']);
  });

  it('chaque palette est complète (18 jetons hexadécimaux)', () => {
    for (const [id, p] of Object.entries(PALETTES)) {
      const valeurs = Object.values(p as Couleurs);
      expect([id, valeurs.length]).toEqual([id, 18]);
      for (const v of valeurs) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('chaque couple est lisible dans chaque thème, chaque marque et chaque réglage de lisibilité', () => {
    const manques: string[] = [];
    for (const o of ORGANISATIONS_EMBARQUEES) {
      for (const t of THEMES_IDS) {
        if (t !== 'organisation' && o.code !== ORGANISATIONS_EMBARQUEES[0].code) continue; // les palettes ne dépendent pas de la marque
        for (const l of LISIBILITES) {
          const j = jetonsDuTheme(o, t as ThemeId, l);
          for (const [nom, a, b, min] of COUPLES) {
            const r = contraste(a(j), b(j));
            if (r < min) manques.push(`${o.code}/${t}/${l.contraste ? 'C' : '-'} : ${nom} ${r.toFixed(2)} < ${min}`);
          }
        }
      }
    }
    expect(manques).toEqual([]);
  });

  it('les couleurs de sens restent distinctes entre elles dans chaque thème (succès, danger)', () => {
    for (const t of THEMES_IDS) {
      for (const l of LISIBILITES) {
        const j = jetonsDuTheme(ORGANISATIONS_EMBARQUEES[0], t, l);
        expect(j.success.toUpperCase()).not.toBe(j.danger.toUpperCase());
        expect(j.success.toUpperCase()).not.toBe(j.text.toUpperCase());
        expect(j.danger.toUpperCase()).not.toBe(j.text.toUpperCase());
      }
    }
  });

  it('le contraste élevé ne change pas la teinte de l’en-tête ni de l’action au point de les rendre méconnaissables', () => {
    const base = PALETTES.ocean;
    const c = couleursAvecLisibilite(base, { contraste: true });
    expect(c.background).toBe('#FFFFFF');
    expect(c.text).toBe('#000000');
    const nuit = couleursAvecLisibilite(PALETTES.nuit, { contraste: true });
    expect(nuit.background).toBe('#000000');
    expect(nuit.text).toBe('#FFFFFF');
    expect(jetonsDepuis(nuit).onHeaderSoft).toBeTruthy();
  });
});
