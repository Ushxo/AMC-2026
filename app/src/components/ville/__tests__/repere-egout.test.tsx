import { fireEvent, render, screen } from '@testing-library/react-native';

import { SelecteurTheme } from '../selecteur-theme';
import { geometrieRepere, RepereEgout } from '../repere-egout';
import { reinitialiserThemePourTests, lirePreferenceTheme } from '../../../lib/theme-pref';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('repère de bouche d’égout', () => {
  it('se dessine dans chaque état sans planter, caché des lecteurs d’écran (le repère de carte porte le libellé)', async () => {
    for (const etat of ['normal', 'choisi', 'attenue', 'prochain', 'fait'] as const) {
      const { unmount } = await render(<RepereEgout couleur="#B3261E" etat={etat} />);
      expect(screen.getByTestId('repere-egout', { includeHiddenElements: true })).toBeTruthy();
      await unmount();
    }
  });
});

describe('ancrage du repère', () => {
  it('la pointe du dessin tombe sur la position', () => {
    const g = geometrieRepere('normal');
    // pointe à 75/84 de la hauteur du dessin (32 pt) + marge de 6 pt, dans une zone de 44 pt
    expect(g.zoneL).toBe(36);
    expect(g.zoneH).toBe(44);
    expect(g.ancre.x).toBe(0.5);
    expect(g.ancre.y).toBeCloseTo((6 + (32 * 75) / 84) / 44, 5);
    expect(g.decalage.y).toBeCloseTo(-((6 + (32 * 75) / 84) - 22), 5);
  });

  it('le prochain arrêt est plus grand', () => {
    expect(geometrieRepere('prochain').zoneH).toBeGreaterThan(geometrieRepere('normal').zoneH);
  });
});

describe('sélecteur de thème', () => {
  beforeEach(() => reinitialiserThemePourTests());

  it('trois boutons, l’état choisi est annoncé, un appui change la préférence', async () => {
    await render(<SelecteurTheme />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByLabelText('Automatique').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Sombre'));
    expect(lirePreferenceTheme()).toBe('sombre');
    expect(screen.getByLabelText('Sombre').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Automatique').props.accessibilityState.checked).toBe(false);
  });
});
