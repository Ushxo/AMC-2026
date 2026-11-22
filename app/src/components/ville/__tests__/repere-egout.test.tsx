import { render, screen } from '@testing-library/react-native';

import { geometrieRepere, RepereEgout } from '../repere-egout';

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

describe('repère numéroté', () => {
  it('écrit le numéro d’arrêt, et la taille de police baisse avec le nombre de chiffres', async () => {
    const { taillePolice } = require('../repere-egout') as typeof import('../repere-egout'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(taillePolice(3)).toBeGreaterThan(taillePolice(12));
    expect(taillePolice(12)).toBeGreaterThan(taillePolice(120));
    const { unmount } = await render(<RepereEgout couleur="#2F7D32" numero={12} />);
    expect(screen.getByTestId('repere-egout', { includeHiddenElements: true })).toBeTruthy();
    await unmount();
  });
});
