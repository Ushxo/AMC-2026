import { NAVIGATION_GOOGLE } from './reglage';
import * as ImplementationMaps from './implementation-maps';

/**
 * Couche de carte commune : la même interface avec deux implémentations.
 * A = react-native-maps (Expo Go, repli, build sans navigation Google) ; B = carte Google de la bibliothèque de navigation.
 * La bibliothèque Google n'est chargée que dans une build faite pour elle (chargement tardif).
 */
const implementation: typeof ImplementationMaps = NAVIGATION_GOOGLE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./implementation-google') as typeof ImplementationMaps)
  : ImplementationMaps;

export const Carte = implementation.Carte;
export const Repere = implementation.Repere;
export const RepereGroupe = implementation.RepereGroupe;
export const Vehicule = implementation.Vehicule;
export const Trace = implementation.Trace;
export const Zone = implementation.Zone;
export const Cercle = implementation.Cercle;
export { NAVIGATION_GOOGLE };
export type * from './types';
