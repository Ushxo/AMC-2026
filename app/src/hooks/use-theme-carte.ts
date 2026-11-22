import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { chargerPreferenceTheme, usePreferenceTheme } from '../lib/theme-pref';

/** Apparence de la CARTE : le choix de l'utilisateur, ou celle de l'appareil en « Automatique ». */
export function useThemeCarte(): 'light' | 'dark' {
  const choix = usePreferenceTheme();
  useEffect(() => {
    void chargerPreferenceTheme();
  }, []);
  const systeme = useColorScheme();
  if (choix === 'clair') return 'light';
  if (choix === 'sombre') return 'dark';
  return systeme === 'dark' ? 'dark' : 'light';
}
