import { StatusBar } from 'react-native';

import { luminance } from './couleurs';
import { useJetons } from './utiliser';

/** Barre d'état de l'iPhone (heure, batterie) : claire sur un en-tête foncé, foncée sur un en-tête clair, selon la marque courante. */
export function BarreEtat() {
  const { header } = useJetons();
  return <StatusBar barStyle={luminance(header) > 0.45 ? 'dark-content' : 'light-content'} />;
}
