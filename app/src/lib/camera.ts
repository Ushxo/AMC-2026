import type { Region } from './config';
import type { Coordonnees } from '../types';

const TAILLE_TUILE = 256;

/** Niveau de zoom Google qui montre `deltaLng` degrés sur `largeur` points. */
export function zoomDepuisDelta(deltaLng: number, largeur: number): number {
  const d = Math.max(deltaLng, 1e-6);
  return Math.log2((360 * Math.max(largeur, 1)) / (TAILLE_TUILE * d));
}

/** Zone visible pour un centre, un zoom et une taille de vue (la vue n'est ni inclinée ni tournée). */
export function regionDepuisCamera(centre: Coordonnees, zoom: number, largeur: number, hauteur: number): Region {
  const deltaLng = (360 * Math.max(largeur, 1)) / (TAILLE_TUILE * 2 ** zoom);
  const deltaLat = deltaLng * (Math.max(hauteur, 1) / Math.max(largeur, 1)) * Math.cos((centre.latitude * Math.PI) / 180);
  return { latitude: centre.latitude, longitude: centre.longitude, latitudeDelta: deltaLat, longitudeDelta: deltaLng };
}

/** Centre et zoom qui cadrent tous les points dans une vue (avec une marge de 15 %). Zoom plafonné pour un seul point. */
export function cadrerPoints(points: Coordonnees[], largeur: number, hauteur: number, zoomMax = 18): { centre: Coordonnees; zoom: number } {
  if (points.length === 0) return { centre: { latitude: 45.5, longitude: -73.57 }, zoom: 12 };
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const centre = { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 };
  const deltaLng = Math.max((maxLng - minLng) * 1.15, 0.0005);
  const deltaLat = Math.max((maxLat - minLat) * 1.15, 0.0005);
  const parLng = zoomDepuisDelta(deltaLng, largeur);
  // Hauteur : la même relation, corrigée par le rapport des échelles Mercator à cette latitude.
  const parLat = zoomDepuisDelta(deltaLat / Math.cos((centre.latitude * Math.PI) / 180) * (largeur / Math.max(hauteur, 1)), largeur);
  return { centre, zoom: Math.min(zoomMax, Math.max(2, Math.min(parLng, parLat))) };
}
