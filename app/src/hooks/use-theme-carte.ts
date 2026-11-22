import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { chargerPreferenceTheme, usePreferenceTheme } from '../lib/theme-pref';
import { useMarque } from '../marque/utiliser';

/** Apparence de la CARTE : le choix de l'utilisateur ; en « Automatique », sombre si le thème de l'app est sombre (Nuit), sinon celui de l'appareil. */
export function useThemeCarte(): 'light' | 'dark' {
  const choix = usePreferenceTheme();
  useEffect(() => {
    void chargerPreferenceTheme();
  }, []);
  const { sombre } = useMarque();
  const systeme = useColorScheme();
  if (choix === 'clair') return 'light';
  if (choix === 'sombre') return 'dark';
  return sombre || systeme === 'dark' ? 'dark' : 'light';
}
