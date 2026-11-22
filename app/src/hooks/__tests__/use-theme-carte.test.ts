import { renderHook } from '@testing-library/react-native';
import { act } from 'react';

import { definirTheme, reinitialiserMarque } from '../../marque/magasin';
import { useThemeCarte } from '../use-theme-carte';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Le téléphone est en mode sombre : la carte ne doit pas en tenir compte.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'dark' }));

beforeEach(() => reinitialiserMarque());

describe('style de la carte', () => {
  it('en Automatique, la carte suit le thème de l’app : sombre seulement pour Nuit, même si le téléphone est en mode sombre', async () => {
    const { result, rerender } = await renderHook(() => useThemeCarte());
    expect(result.current).toBe('light'); // thème de l'organisation, téléphone en sombre
    await act(async () => definirTheme('nuit'));
    await rerender({});
    expect(result.current).toBe('dark');
    await act(async () => definirTheme('ocean'));
    await rerender({});
    expect(result.current).toBe('light');
  });
});
