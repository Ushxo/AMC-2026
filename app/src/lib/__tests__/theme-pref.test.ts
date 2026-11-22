import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import {
  chargerPreferenceTheme,
  CLE_THEME,
  definirPreferenceTheme,
  lirePreferenceTheme,
  reinitialiserThemePourTests,
} from '../theme-pref';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('préférence de thème', () => {
  let regler: jest.SpyInstance;
  beforeEach(async () => {
    await AsyncStorage.clear();
    reinitialiserThemePourTests();
    regler = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  });
  afterEach(() => regler.mockRestore());

  it('est « Automatique » par défaut et rend la main à l’appareil', async () => {
    await chargerPreferenceTheme();
    expect(lirePreferenceTheme()).toBe('auto');
    expect(regler).not.toHaveBeenCalled();
  });

  it('un choix s’applique à toute l’app et se garde', async () => {
    await definirPreferenceTheme('sombre');
    expect(lirePreferenceTheme()).toBe('sombre');
    expect(regler).toHaveBeenLastCalledWith('dark');
    expect(await AsyncStorage.getItem(CLE_THEME)).toBe('sombre');
    await definirPreferenceTheme('clair');
    expect(regler).toHaveBeenLastCalledWith('light');
    await definirPreferenceTheme('auto');
    expect(regler).toHaveBeenLastCalledWith('auto');
  });

  it('relit le choix gardé au démarrage', async () => {
    await AsyncStorage.setItem(CLE_THEME, 'sombre');
    await chargerPreferenceTheme();
    expect(lirePreferenceTheme()).toBe('sombre');
    expect(regler).toHaveBeenCalledWith('dark');
  });

  it('ignore une valeur inconnue', async () => {
    await AsyncStorage.setItem(CLE_THEME, 'violet');
    await chargerPreferenceTheme();
    expect(lirePreferenceTheme()).toBe('auto');
  });

  it('un stockage en panne ne casse rien', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('panne'));
    await expect(definirPreferenceTheme('clair')).resolves.toBeUndefined();
    expect(lirePreferenceTheme()).toBe('clair');
  });
});
