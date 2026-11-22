import type { CoucheGrilles, Endroit } from '../../types';
import type { Region } from '../config';
import { bouchesVisibles, idsAvecSignalement, MAX_BOUCHES, SEUIL_ZOOM_DELTA } from '../bouches';

function grilles(n: number): CoucheGrilles {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [-73.57 + (i % 40) * 0.0001, 45.5 + Math.floor(i / 40) * 0.0001] },
      properties: { id: String(i), origine: 'officiel', adresse: null, provenance: null },
    })),
  } as unknown as CoucheGrilles;
}

const zoome: Region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.008, longitudeDelta: 0.012 };

describe('bouches existantes (grises)', () => {
  it('rien tant que la carte n’est pas assez zoomée, ni sans région', () => {
    expect(bouchesVisibles(grilles(50), null, new Set())).toEqual([]);
    expect(bouchesVisibles(grilles(50), { ...zoome, latitudeDelta: SEUIL_ZOOM_DELTA + 0.01 }, new Set())).toEqual([]);
  });

  it('seulement la zone visible', () => {
    const loin: Region = { ...zoome, latitude: 46.5 };
    expect(bouchesVisibles(grilles(50), loin, new Set())).toEqual([]);
    expect(bouchesVisibles(grilles(50), zoome, new Set()).length).toBe(50);
  });

  it('plafonnées à 150, les plus proches du centre', () => {
    const r = bouchesVisibles(grilles(1000), zoome, new Set());
    expect(r).toHaveLength(MAX_BOUCHES);
    const maxCentre = Math.max(...r.map((b) => (b.position.latitude - zoome.latitude) ** 2 + (b.position.longitude - zoome.longitude) ** 2));
    const tous = bouchesVisibles(grilles(1000), zoome, new Set(), 1000);
    expect(tous.length).toBeGreaterThan(150);
    expect(tous[149].position).toEqual(r[149].position);
    expect(maxCentre).toBeLessThanOrEqual(
      (tous[150].position.latitude - zoome.latitude) ** 2 + (tous[150].position.longitude - zoome.longitude) ** 2 + 1e-12,
    );
  });

  it('exclut les bouches qui ont un signalement ouvert (elles ont déjà leur repère de gravité)', () => {
    const e = (cle: string, nombre: number) => ({ cle, nombre }) as Endroit;
    const exclues = idsAvecSignalement([e('grille:3', 2), e('grille:4', 0), e('case:1:2', 1)]);
    expect([...exclues]).toEqual(['3']);
    const ids = bouchesVisibles(grilles(10), zoome, exclues).map((b) => b.id);
    expect(ids).not.toContain('3');
    expect(ids).toContain('4'); // tout réglé : retour au gris
  });
});
