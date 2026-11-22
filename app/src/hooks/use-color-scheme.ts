import { useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { chargerPreferenceTheme } from '../lib/theme-pref';

/**
 * Apparence de l'app. Le choix de l'utilisateur (clair, sombre, automatique) est appliqué à l'appareil entier
 * par lib/theme-pref : ce hook suit donc ce choix partout, sans toucher chaque écran.
 */
export function useColorScheme(): 'light' | 'dark' | null | undefined {
  const scheme = useSystemColorScheme();
  useEffect(() => {
    void chargerPreferenceTheme();
  }, []);
  return scheme;
}
