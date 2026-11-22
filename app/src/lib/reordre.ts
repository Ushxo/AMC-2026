import type { Arret, Coordonnees } from '../types';
import { distanceM } from './geo';

/** Écart au premier arrêt prévu à partir duquel on propose de recalculer l'ordre. */
export const SEUIL_RECALCUL_M = 300;

/** Longueur à vol d'oiseau d'un chemin ouvert qui part de `depart`. */
export function longueurChemin(depart: Coordonnees, points: Coordonnees[]): number {
  let total = 0;
  let courant = depart;
  for (const p of points) {
    total += distanceM(courant, p);
    courant = p;
  }
  return total;
}

/** Plus proche voisin depuis `depart`, puis 2-opt (chemin ouvert, départ fixe). Rend l'ordre des indices de `points`. */
export function ordreEstime(depart: Coordonnees, points: Coordonnees[]): number[] {
  const restant = points.map((_, i) => i);
  const ordre: number[] = [];
  let courant = depart;
  while (restant.length > 0) {
    let meilleur = 0;
    for (let k = 1; k < restant.length; k++) {
      if (distanceM(courant, points[restant[k]]) < distanceM(courant, points[restant[meilleur]])) meilleur = k;
    }
    const [i] = restant.splice(meilleur, 1);
    ordre.push(i);
    courant = points[i];
  }
  // 2-opt : on inverse un segment tant que cela raccourcit le chemin.
  let ameliore = true;
  let tours = 0;
  while (ameliore && tours < 50) {
    ameliore = false;
    tours += 1;
    for (let i = 0; i < ordre.length - 1; i++) {
      for (let j = i + 1; j < ordre.length; j++) {
        const avant = i === 0 ? depart : points[ordre[i - 1]];
        const a = points[ordre[i]];
        const b = points[ordre[j]];
        const apres = j + 1 < ordre.length ? points[ordre[j + 1]] : null;
        const actuel = distanceM(avant, a) + (apres ? distanceM(b, apres) : 0);
        const neuf = distanceM(avant, b) + (apres ? distanceM(a, apres) : 0);
        if (neuf + 1e-6 < actuel) {
          const segment = ordre.slice(i, j + 1).reverse();
          ordre.splice(i, segment.length, ...segment);
          ameliore = true;
        }
      }
    }
  }
  return ordre;
}

/** Arrêts restants réordonnés depuis la position (estimation à vol d'oiseau, sans routes). */
export function reordonnerRestants(position: Coordonnees, restants: Arret[]): Arret[] {
  return ordreEstime(position, restants.map((a) => a.position)).map((i) => restants[i]);
}

/**
 * Faut-il proposer « Recalculer l'ordre depuis ma position » ? Oui si l'équipe est à plus de 300 m du premier arrêt
 * prévu et qu'un autre arrêt non fait est plus proche.
 */
export function proposerRecalcul(position: Coordonnees | null, restants: Arret[]): boolean {
  if (!position || restants.length < 2) return false;
  const premier = distanceM(position, restants[0].position);
  if (premier <= SEUIL_RECALCUL_M) return false;
  return restants.slice(1).some((a) => distanceM(position, a.position) < premier);
}
