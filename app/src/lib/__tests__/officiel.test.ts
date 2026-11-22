import { assemblerCouches, chargerAdresses, chargerCouches, chargerSignalementsDemo } from '../officiel';

describe('officiel', () => {
  it('assemblerCouches : couches manquantes ou invalides vides', () => {
    const c = assemblerCouches({
      grilles: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: {} }] },
      chantiers: 'nimporte quoi',
      meta: { copieDu: '2026-11-21' },
    });
    expect(c.grilles.features).toHaveLength(1);
    expect(c.avisEau.features).toEqual([]);
    expect(c.chantiers.features).toEqual([]);
    expect(c.zonesInondables.features).toEqual([]);
    expect(c.copieDu).toBe('2026-11-21');
  });

  it("l'app démarre même si aucun fichier n'est présent", () => {
    const c = chargerCouches();
    expect(Array.isArray(c.grilles.features)).toBe(true);
    expect(Array.isArray(c.avisEau.features)).toBe(true);
    expect(Array.isArray(c.chantiers.features)).toBe(true);
    expect(Array.isArray(chargerAdresses())).toBe(true);
    expect(Array.isArray(chargerSignalementsDemo())).toBe(true);
  });

  it('chantiers et zones inondables : couches complètes quand les fichiers sont fournis', () => {
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.56, 45.5] }, properties: { id: 'c1' } };
    const zone = {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      properties: { id: 'z1', source: 'crues 2022' },
    };
    const c = assemblerCouches({
      chantiers: { type: 'FeatureCollection', features: [point] },
      zonesInondables: { type: 'FeatureCollection', features: [zone] },
    });
    expect(c.chantiers.features).toHaveLength(1);
    expect(c.zonesInondables.features).toHaveLength(1);
  });

  it('les fichiers embarqués donnent des couches non vides', () => {
    const c = chargerCouches();
    expect(c.chantiers.features.length).toBeGreaterThan(0);
    expect(c.zonesInondables.features.length).toBeGreaterThan(0);
  });
});
