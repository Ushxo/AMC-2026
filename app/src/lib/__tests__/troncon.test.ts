import { lireTronconOsrm, tronconDepuisOsrm, tronconDroit } from '../troncon';

const A = { latitude: 45.5, longitude: -73.57 };
const B = { latitude: 45.51, longitude: -73.56 };

describe('tronçon de route', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ligne droite annoncée comme telle, avec distance et durée estimées', () => {
    const t = tronconDroit(A, B);
    expect(t.droite).toBe(true);
    expect(t.points).toEqual([A, B]);
    expect(t.distance_m).toBeGreaterThan(1000);
    expect(t.duree_s).toBeGreaterThan(100);
  });

  it('lit la réponse OSRM (longitude, latitude)', () => {
    const t = tronconDepuisOsrm({
      routes: [{ distance: 1234, duration: 210, geometry: { coordinates: [[-73.57, 45.5], [-73.565, 45.505], [-73.56, 45.51]] } }],
    });
    expect(t?.droite).toBe(false);
    expect(t?.distance_m).toBe(1234);
    expect(t?.points[1]).toEqual({ latitude: 45.505, longitude: -73.565 });
    expect(tronconDepuisOsrm({ routes: [] })).toBeNull();
    expect(tronconDepuisOsrm(null)).toBeNull();
    expect(tronconDepuisOsrm({ routes: [{ distance: 1, duration: 1, geometry: { coordinates: [[1, 2]] } }] })).toBeNull();
  });

  it('appelle OSRM avec un User-Agent et rend null en cas d’échec réseau ou de réponse invalide', async () => {
    const ok = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 500, duration: 60, geometry: { coordinates: [[-73.57, 45.5], [-73.56, 45.51]] } }] }),
    });
    globalThis.fetch = ok as unknown as typeof fetch;
    const t = await lireTronconOsrm(A, B);
    expect(t?.distance_m).toBe(500);
    const [url, options] = ok.mock.calls[0];
    expect(String(url)).toContain('router.project-osrm.org/route/v1/driving/-73.57,45.5;-73.56,45.51');
    expect((options as { headers: Record<string, string> }).headers['User-Agent']).toBeTruthy();

    globalThis.fetch = jest.fn().mockRejectedValue(new Error('réseau')) as unknown as typeof fetch;
    expect(await lireTronconOsrm(A, B)).toBeNull();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await lireTronconOsrm(A, B)).toBeNull();
  });
});
