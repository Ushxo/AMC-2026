import type { Region } from './config';
import type { Coordonnees } from '../types';

/** Rayon visible autour du citoyen à l'ouverture de la carte. */
export const RAYON_CITOYEN_M = 400;

const M_PAR_DEGRE_LAT = 110540;

/** Vrai si le point est dans la boîte du quartier de démonstration (la région de la copie locale). */
export function dansQuartier(p: Coordonnees, region: Region): boolean {
  return (
    Math.abs(p.latitude - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(p.longitude - region.longitude) <= region.longitudeDelta / 2
  );
}

/** Étendue visible (en degrés) pour un rayon en mètres autour d'un point. */
export function deltasPourRayon(centre: Coordonnees, rayonM: number): { latitudeDelta: number; longitudeDelta: number } {
  return {
    latitudeDelta: (2 * rayonM) / M_PAR_DEGRE_LAT,
    longitudeDelta: (2 * rayonM) / (111320 * Math.cos((centre.latitude * Math.PI) / 180)),
  };
}

export type StatutPosition = 'attente' | 'ok' | 'refusee' | 'indisponible';

/** Message court sous la carte selon la position du citoyen, ou null s'il n'y a rien à dire. */
export function messagePositionCarte(statut: StatutPosition, position: Coordonnees | null, region: Region): string | null {
  if (statut === 'refusee') return 'Position refusée : la carte montre le quartier.';
  if (statut === 'indisponible') return 'Position introuvable : la carte montre le quartier.';
  if (statut === 'ok' && position && !dansQuartier(position, region)) {
    return 'Vous êtes hors du quartier de démonstration : la carte reste sur le quartier.';
  }
  return null;
}
