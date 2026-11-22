import type { CoucheGrilles } from '../../types';
import { REGION_DEMO } from '../config';
import { dansMontreal, dansRegion, distanceM, grillePlusProche, pointDansGeometrie } from '../geo';

const carre = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-73.57, 45.5],
      [-73.56, 45.5],
      [-73.56, 45.51],
      [-73.57, 45.51],
      [-73.57, 45.5],
    ],
  ],
};

describe('geo', () => {
  it('distanceM : 0 pour le même point, environ 111 m pour 0,001° de latitude', () => {
    const a = { latitude: 45.5, longitude: -73.56 };
    expect(distanceM(a, a)).toBe(0);
    const d = distanceM(a, { latitude: 45.501, longitude: -73.56 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });

  it('pointDansGeometrie : polygone, trou, multipolygone, point, null', () => {
    expect(pointDansGeometrie({ latitude: 45.505, longitude: -73.565 }, carre)).toBe(true);
    expect(pointDansGeometrie({ latitude: 45.52, longitude: -73.565 }, carre)).toBe(false);
    const troue = {
      type: 'Polygon' as const,
      coordinates: [
        carre.coordinates[0],
        [
          [-73.566, 45.504],
          [-73.564, 45.504],
          [-73.564, 45.506],
          [-73.566, 45.506],
          [-73.566, 45.504],
        ],
      ],
    };
    expect(pointDansGeometrie({ latitude: 45.505, longitude: -73.565 }, troue)).toBe(false);
    expect(
      pointDansGeometrie(
        { latitude: 45.505, longitude: -73.565 },
        { type: 'MultiPolygon', coordinates: [carre.coordinates] },
      ),
    ).toBe(true);
    const pt = { type: 'Point' as const, coordinates: [-73.565, 45.505] };
    expect(pointDansGeometrie({ latitude: 45.5055, longitude: -73.565 }, pt)).toBe(true);
    expect(pointDansGeometrie({ latitude: 45.51, longitude: -73.565 }, pt)).toBe(false);
    expect(pointDansGeometrie({ latitude: 45.505, longitude: -73.565 }, null)).toBe(false);
  });

  it('dansMontreal', () => {
    expect(dansMontreal({ latitude: 45.5, longitude: -73.56 })).toBe(true);
    expect(dansMontreal({ latitude: 46.8, longitude: -71.2 })).toBe(false);
    expect(dansMontreal({ latitude: NaN, longitude: -73.56 })).toBe(false);
  });

  it('grillePlusProche : la plus proche dans le rayon, sinon null', () => {
    const grilles: CoucheGrilles = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-73.56, 45.5002] },
          properties: { id: 'loin', origine: 'officiel', gravite: 'faible', adresse: null, provenance: null },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-73.56, 45.5001] },
          properties: { id: 'proche', origine: 'officiel', gravite: 'faible', adresse: null, provenance: null },
        },
      ],
    };
    expect(grillePlusProche({ latitude: 45.5, longitude: -73.56 }, grilles, 25)?.properties.id).toBe('proche');
    expect(grillePlusProche({ latitude: 45.52, longitude: -73.56 }, grilles, 25)).toBeNull();
  });

  it('dansRegion', () => {
    expect(dansRegion({ latitude: 45.505, longitude: -73.5675 }, REGION_DEMO)).toBe(true);
    expect(dansRegion({ latitude: 45.6, longitude: -73.5675 }, REGION_DEMO)).toBe(false);
  });
});
