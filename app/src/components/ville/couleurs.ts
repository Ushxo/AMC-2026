import { useColorScheme } from '@/hooks/use-color-scheme';

import { COULEURS_TEXTE } from './style';

export function useCouleursTexte() {
  return useColorScheme() === 'dark' ? COULEURS_TEXTE.dark : COULEURS_TEXTE.light;
}
