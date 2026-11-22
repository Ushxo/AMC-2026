import { cadrerPoints, regionDepuisCamera, zoomDepuisDelta } from '../camera';

describe('caméra', () => {
  it('zoom et zone visible sont inverses l’un de l’autre', () => {
    const largeur = 360;
    const z = zoomDepuisDelta(0.03, largeur);
    const r = regionDepuisCamera({ latitude: 45.5, longitude: -73.57 }, z, largeur, 400);
    expect(r.longitudeDelta).toBeCloseTo(0.03, 5);
    expect(r.latitude).toBe(45.5);
    expect(r.latitudeDelta).toBeGreaterThan(0.015);
    expect(r.latitudeDelta).toBeLessThan(0.03);
  });

  it('plus on zoome, plus la zone est petite', () => {
    const a = regionDepuisCamera({ latitude: 45.5, longitude: -73.57 }, 12, 360, 400);
    const b = regionDepuisCamera({ latitude: 45.5, longitude: -73.57 }, 15, 360, 400);
    expect(b.longitudeDelta).toBeLessThan(a.longitudeDelta);
    expect(a.longitudeDelta / b.longitudeDelta).toBeCloseTo(8, 3);
  });

  it('cadre un ensemble de points au centre, avec un zoom plafonné pour un seul point', () => {
    const { centre, zoom } = cadrerPoints(
      [{ latitude: 45.5, longitude: -73.6 }, { latitude: 45.52, longitude: -73.5 }],
      360,
      400,
    );
    expect(centre.latitude).toBeCloseTo(45.51);
    expect(centre.longitude).toBeCloseTo(-73.55);
    expect(zoom).toBeGreaterThan(9);
    expect(zoom).toBeLessThan(14);
    expect(cadrerPoints([{ latitude: 45.5, longitude: -73.57 }], 360, 400).zoom).toBeLessThanOrEqual(18);
    expect(cadrerPoints([], 360, 400).zoom).toBe(12);
  });
});
