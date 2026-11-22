import { useEffect } from 'react';

import { chargerPreferenceTheme, usePreferenceTheme } from '../lib/theme-pref';
import { useMarque } from '../marque/utiliser';

/**
 * Style de la CARTE : le choix de l'utilisateur ; en « Automatique », il suit le thème de l'app (sombre seulement pour un thème sombre,
 * comme Nuit). Le mode clair ou sombre du téléphone n'entre jamais en jeu.
 */
export function useThemeCarte(): 'light' | 'dark' {
  const choix = usePreferenceTheme();
  useEffect(() => {
    void chargerPreferenceTheme();
  }, []);
  const { sombre } = useMarque();
  if (choix === 'clair') return 'light';
  if (choix === 'sombre') return 'dark';
  return sombre ? 'dark' : 'light';
}
