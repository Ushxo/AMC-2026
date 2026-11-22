import { renderHook } from '@testing-library/react-native';

import type { CoucheAvisEau } from '../../types';
import { trouverZoneEau, useZoneEau } from '../use-zone-eau';

const avis: CoucheAvisEau = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-73.57, 45.5], [-73.56, 45.5], [-73.56, 45.51], [-73.57, 45.51], [-73.57, 45.5]]],
      },
      properties: { id: 'a1', origine: 'officiel', gravite: 'elevee', type: 'ebullition', titre: 'Avis', adresse: null, debut: '2026-11-01', fin: null, placement: 'geometrie_source' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.5, 45.6] },
      properties: { id: 'a2', origine: 'officiel', gravite: 'moyenne', type: 'coupure', titre: 'Coupure', adresse: null, debut: '2026-11-01', fin: null, placement: 'adresse' },
    },
    {
      type: 'Feature',
      geometry: null,
      properties: { id: 'a3', origine: 'officiel', gravite: 'faible', type: 'coupure', titre: 'Sans lieu', adresse: null, debut: '2026-11-01', fin: null, placement: 'aucun' },
    },
  ],
};

describe('trouverZoneEau', () => {
  it('trouve un avis par polygone', () => {
    const r = trouverZoneEau({ latitude: 45.505, longitude: -73.565 }, avis);
    expect(r.dansZone).toBe(true);
    expect(r.avis.map((a) => a.properties.id)).toEqual(['a1']);
  });
  it('trouve un avis ponctuel à moins de 150 m, pas au-delà', () => {
    expect(trouverZoneEau({ latitude: 45.6005, longitude: -73.5 }, avis).avis[0].properties.id).toBe('a2');
    expect(trouverZoneEau({ latitude: 45.602, longitude: -73.5 }, avis).dansZone).toBe(false);
  });
  it('point nul ou avis sans lieu : rien', () => {
    expect(trouverZoneEau(null, avis)).toEqual({ dansZone: false, avis: [] });
  });
});

describe('useZoneEau', () => {
  it('ne plante pas sans données embarquées', async () => {
    const { result } = await renderHook(() => useZoneEau({ latitude: 45.5, longitude: -73.56 }));
    expect(result.current.avis).toEqual(expect.any(Array));
  });
});

describe('useZoneEau avec les données de démo', () => {
  it("trouve l'avis de l'adresse de démo (meta.json)", async () => {
    let meta: { adresseDemo?: { latitude: number; longitude: number } } = {};
    try {
      meta = require('../../donnees/meta.json');
    } catch {
      return;
    }
    if (!meta.adresseDemo) return;
    const { result } = await renderHook(() => useZoneEau(meta.adresseDemo!));
    expect(result.current.dansZone).toBe(true);
  });
});
