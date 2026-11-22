/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * L'interface est claire seulement (le design du coéquipier) : le mode sombre ne concerne que le style de la carte
 * (sélecteur « Carte »). Passer INTERFACE_CLAIRE à false rendrait la palette sombre au réglage de l'appareil.
 */
const INTERFACE_CLAIRE = true;

export function useTheme() {
  const scheme = useColorScheme();
  const theme = !INTERFACE_CLAIRE && scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
