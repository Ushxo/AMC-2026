import { renderHook } from '@testing-library/react-native';

import { definirApparence, reinitialiserMarque } from '../../marque/magasin';
import { useThemeCarte } from '../use-theme-carte';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'light' }));

beforeEach(() => reinitialiserMarque());

describe('style de la carte', () => {
  it('en Automatique, la carte suit l’apparence Sombre de l’app, sinon l’appareil', async () => {
    const { result, rerender } = await renderHook(() => useThemeCarte());
    expect(result.current).toBe('light');
    definirApparence('sombre');
    await rerender({});
    expect(result.current).toBe('dark');
    definirApparence('contraste');
    await rerender({});
    expect(result.current).toBe('light');
  });
});
