import { renderHook } from '@testing-library/react-native';
import { act } from 'react';

import { definirTheme, reinitialiserMarque } from '../../marque/magasin';
import { THEMES_IDS } from '../../marque/themes';
import { useThemeCarte } from '../use-theme-carte';

// Un ancien choix « Sombre » gardé sur le téléphone, et un téléphone en mode sombre : ni l'un ni l'autre ne doit compter.
jest.mock('@react-native-async-storage/async-storage', () => {
  const m = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
  void m.setItem('signalement-mtl:theme', 'sombre');
  return m;
});
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'dark' }));

beforeEach(() => reinitialiserMarque());

describe('style de la carte : toujours celui du thème de l’app', () => {
  it.each(THEMES_IDS)('thème %s : sombre seulement pour Nuit', async (theme) => {
    const { result } = await renderHook(() => useThemeCarte());
    await act(async () => definirTheme(theme));
    expect(result.current).toBe(theme === 'nuit' ? 'dark' : 'light');
  });

  it('un ancien choix gardé (« sombre ») est ignoré : thème de l’organisation, carte claire', async () => {
    const { result } = await renderHook(() => useThemeCarte());
    expect(result.current).toBe('light');
  });
});
