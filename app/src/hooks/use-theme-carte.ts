import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { chargerPreferenceTheme, usePreferenceTheme } from '../lib/theme-pref';
import { useMarque } from '../marque/utiliser';

/** Apparence de la CARTE : le choix de l'utilisateur ; en « Automatique », sombre si l'apparence de l'app est Sombre, sinon celle de l'appareil. */
export function useThemeCarte(): 'light' | 'dark' {
  const choix = usePreferenceTheme();
  useEffect(() => {
    void chargerPreferenceTheme();
  }, []);
  const { apparence } = useMarque();
  const systeme = useColorScheme();
  if (choix === 'clair') return 'light';
  if (choix === 'sombre') return 'dark';
  return apparence === 'sombre' || systeme === 'dark' ? 'dark' : 'light';
}
