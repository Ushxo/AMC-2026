import AsyncStorage from '@react-native-async-storage/async-storage';

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
  beforeEach(async () => {
    await AsyncStorage.clear();
    reinitialiserThemePourTests();
  });

  it('est « Automatique » par défaut', async () => {
    await chargerPreferenceTheme();
    expect(lirePreferenceTheme()).toBe('auto');
  });

  it('un choix se garde (style de la carte seulement)', async () => {
    await definirPreferenceTheme('sombre');
    expect(lirePreferenceTheme()).toBe('sombre');
    expect(await AsyncStorage.getItem(CLE_THEME)).toBe('sombre');
    await definirPreferenceTheme('clair');
    await definirPreferenceTheme('auto');
  });

  it('relit le choix gardé au démarrage', async () => {
    await AsyncStorage.setItem(CLE_THEME, 'sombre');
    await chargerPreferenceTheme();
    expect(lirePreferenceTheme()).toBe('sombre');
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

describe('style de la carte selon la préférence', () => {
  it('ne touche jamais à l’apparence de l’app', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Appearance } = require('react-native');
    const regler = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    void definirPreferenceTheme('sombre');
    expect(regler).not.toHaveBeenCalled();
    regler.mockRestore();
  });
});
