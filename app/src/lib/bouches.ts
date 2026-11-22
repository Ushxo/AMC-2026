import type { Coordonnees, Endroit } from '../types';
import type { Region } from './config';

/** Les regards d'égout du quartier ne s'affichent qu'à fort zoom, dans la zone visible, au plus MAX_BOUCHES. */
export const SEUIL_ZOOM_DELTA = 0.012;
export const MAX_BOUCHES = 150;

export type BoucheExistante = { id: string; position: Coordonnees; adresse?: string | null };

/** Regard d'égout tel que dans la copie locale (donnees/regards.json). */
export type SourceBouche = { id: string | number; latitude: number; longitude: number; adresse?: string | null };

/** Identifiants de bouche qui ont déjà un signalement ouvert (elles sont affichées avec leur gravité, pas en gris). */
export function idsAvecSignalement(endroits: Endroit[]): Set<string> {
  const ids = new Set<string>();
  for (const e of endroits) {
    if (e.nombre > 0 && e.cle.startsWith('grille:')) ids.add(e.cle.slice('grille:'.length));
  }
  return ids;
}

/**
 * Bouches grises à montrer : seulement si la carte est assez zoomée, dans la zone visible, sans celles qui ont
 * un signalement ouvert ; les plus proches du centre d'abord, plafonnées à `max`.
 */
export function bouchesVisibles(
  sources: SourceBouche[],
  region: Region | null,
  exclues: Set<string>,
  max: number = MAX_BOUCHES,
): BoucheExistante[] {
  if (!region || region.latitudeDelta > SEUIL_ZOOM_DELTA) return [];
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLng = region.longitude + region.longitudeDelta / 2;
  const trouvees: (BoucheExistante & { d: number })[] = [];
  for (const r of sources) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
    const id = String(r.id);
    if (exclues.has(id)) continue;
    trouvees.push({
      id,
      position: { latitude: lat, longitude: lng },
      adresse: r.adresse ?? null,
      d: (lat - region.latitude) ** 2 + (lng - region.longitude) ** 2,
    });
  }
  trouvees.sort((a, b) => a.d - b.d);
  return trouvees.slice(0, max).map(({ id, position, adresse }) => ({ id, position, adresse }));
}
