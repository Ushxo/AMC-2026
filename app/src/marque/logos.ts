import type { CleLogo } from './organisations-embarquees';

/** Logos embarqués : la base ne garde que la clé, l'app a les images (elle marche sans réseau). */
const LOGOS: Record<CleLogo, number> = {
  priorix: require('../../assets/images/marques/priorix.png'),
  fleur: require('../../assets/images/marques/fleur.png'),
};

export const LIBELLES_LOGO: Record<CleLogo, string> = { priorix: 'Repère à grille', fleur: 'Fleur à grille' };

/** L'image du logo ; une clé inconnue reprend le logo Priorix. */
export function imageLogo(cle: string): number {
  return LOGOS[cle as CleLogo] ?? LOGOS.priorix;
}
