import { useMemo } from 'react';

import { pointDansGeometrie } from '../lib/geo';
import type { AvisEau, CoucheAvisEau, Coordonnees, ZoneEauTrouvee } from '../types';
import { useCouches } from './use-couches';

/** Avis d'ébullition ou coupures qui touchent un point (polygone, ou point à moins de 150 m). */
export function trouverZoneEau(point: Coordonnees | null, avis: CoucheAvisEau): ZoneEauTrouvee {
  if (!point) return { dansZone: false, avis: [] };
  const trouves: AvisEau[] = avis.features.filter((f) => pointDansGeometrie(point, f.geometry));
  return { dansZone: trouves.length > 0, avis: trouves };
}

export function useZoneEau(point: Coordonnees | null): ZoneEauTrouvee {
  const { couches } = useCouches();
  const lat = point?.latitude;
  const lng = point?.longitude;
  return useMemo(
    () => trouverZoneEau(lat === undefined || lng === undefined ? null : { latitude: lat, longitude: lng }, couches.avisEau),
    [lat, lng, couches.avisEau],
  );
}
