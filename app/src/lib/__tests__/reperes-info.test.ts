import { centreSecteur, creerGardeToucher, milieuTrace, reperesInfo } from '../reperes-info';
import type { AvisEau } from '../../types';

jest.mock('../avis-troncons', () => ({ tracesAvis: jest.fn(() => null), infoAvis: jest.fn(() => undefined), distanceTraceAvisM: jest.fn(() => null) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tracesAvis } = require('../avis-troncons') as { tracesAvis: jest.Mock };

const avis = (id: string, type: 'ebullition' | 'coupure', geometry: AvisEau['geometry']): AvisEau =>
  ({ type: 'Feature', geometry, properties: { id, origine: 'officiel', gravite: 'moyenne', type, titre: `Avis d'ébullition d'eau – Rue Test ${id}`, adresse: null, debut: '2026-11-20T10:00:00', fin: null, placement: 'geometrie_source' } }) as AvisEau;

describe('position des repères d’information', () => {
  it('milieu d’une ligne : au milieu de la longueur, pas au milieu des points', () => {
    const m = milieuTrace([
      { latitude: 45.5, longitude: -73.57 },
      { latitude: 45.5, longitude: -73.568 }, // court
      { latitude: 45.5, longitude: -73.56 }, // long
    ]);
    expect(m!.longitude).toBeCloseTo(-73.565, 3);
    expect(milieuTrace([])).toBeNull();
    expect(milieuTrace([{ latitude: 1, longitude: 2 }])).toEqual({ latitude: 1, longitude: 2 });
  });

  it('centre d’un secteur : à l’intérieur, même pour une forme en L', () => {
    const carre = [45.5, -73.57, 45.5, -73.56, 45.51, -73.56, 45.51, -73.57].reduce<{ latitude: number; longitude: number }[]>((a, v, i, t) => (i % 2 ? a : [...a, { latitude: v, longitude: t[i + 1] }]), []);
    const c = centreSecteur(carre)!;
    expect(c.latitude).toBeCloseTo(45.505, 3);
    expect(c.longitude).toBeCloseTo(-73.565, 3);
    const L = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 10 },
      { latitude: 2, longitude: 10 },
      { latitude: 2, longitude: 2 },
      { latitude: 10, longitude: 2 },
      { latitude: 10, longitude: 0 },
    ];
    const cl = centreSecteur(L)!;
    const dedansL = (cl.longitude >= 0 && cl.longitude <= 10 && cl.latitude >= 0 && cl.latitude <= 2) || (cl.longitude >= 0 && cl.longitude <= 2 && cl.latitude >= 0 && cl.latitude <= 10);
    expect(dedansL).toBe(true);
  });
});

describe('repères d’information', () => {
  it('un repère par avis (milieu du tracé, centre du secteur, point), avec son libellé lu', () => {
    tracesAvis.mockReturnValueOnce([[{ latitude: 45.5, longitude: -73.57 }, { latitude: 45.5, longitude: -73.56 }]]);
    const r = reperesInfo({
      avis: [
        avis('1', 'ebullition', null),
        avis('2', 'coupure', { type: 'Polygon', coordinates: [[[-73.57, 45.5], [-73.56, 45.5], [-73.56, 45.51], [-73.57, 45.51], [-73.57, 45.5]]] }),
        avis('3', 'coupure', { type: 'Point', coordinates: [-73.55, 45.49] }),
      ],
      bandes: [{ id: 'b1', rue: 'rue Guy', traces: [[{ latitude: 45.5, longitude: -73.58 }, { latitude: 45.5, longitude: -73.579 }]], signalement_ids: ['s1', 's2'] }],
      chantiers: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.59, 45.52] }, properties: { id: 'c1', titre: 'Travaux rue X' } }] as never,
      zones: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-73.6, 45.5], [-73.59, 45.5], [-73.59, 45.51], [-73.6, 45.5]]] }, properties: { id: 'z1' } }] as never,
    });
    const avisInfos = r.filter((x) => x.id.startsWith('info-avis-'));
    expect(avisInfos.map((x) => x.id)).toEqual(['info-avis-1', 'info-avis-2', 'info-avis-3']);
    expect(r.find((x) => x.id === 'info-avis-2')!.position.latitude).toBeCloseTo(45.505, 3); // secteur : centre
    expect(r.find((x) => x.id === 'info-avis-1')!.position.longitude).toBeCloseTo(-73.565, 3);
    expect(r.find((x) => x.id === 'info-avis-1')!.libelle).toBe("Avis d'ébullition, Rue Test 1");
    expect(r.find((x) => x.genre === 'bande')!.libelle).toBe('Eau accumulée signalée, rue Guy');
    expect(r.find((x) => x.genre === 'bande')!.fiche.lignes[0].valeur).toBe('2');
    expect(r.some((x) => x.genre === 'chantier')).toBe(true);
    expect(r.some((x) => x.genre === 'zone')).toBe(true);
  });

  it('couche masquée = aucun repère', () => {
    expect(reperesInfo({ avis: [], bandes: [], chantiers: null, zones: null })).toEqual([]);
  });
});

describe('garde contre les doubles toucher', () => {
  it('un toucher = un élément ; la carte est ignorée 300 ms après', () => {
    let t = 1000;
    const g = creerGardeToucher(300, () => t);
    expect(g.recent()).toBe(false);
    expect(g.prendre()).toBe(true); // le repère répond
    expect(g.prendre()).toBe(false); // le tracé répond au même toucher : ignoré
    expect(g.recent()).toBe(true); // l'écho sur la carte : ignoré
    t += 301;
    expect(g.recent()).toBe(false);
    expect(g.prendre()).toBe(true); // un nouveau toucher
  });

  it('un repère de signalement note son toucher sans ouvrir de fiche, et la carte reste muette', () => {
    let t = 0;
    const g = creerGardeToucher(300, () => t);
    g.marquer();
    expect(g.recent()).toBe(true);
    t += 299;
    expect(g.recent()).toBe(true);
    t += 2;
    expect(g.recent()).toBe(false);
  });
});
