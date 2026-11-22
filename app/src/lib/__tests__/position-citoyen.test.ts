import { REGION_DEMO } from '../config';
import { dansQuartier, deltasPourRayon, messagePositionCarte, RAYON_CITOYEN_M } from '../position-citoyen';

const region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.03, longitudeDelta: 0.04 };

describe('position du citoyen sur la carte', () => {
  it('dansQuartier : dans la boîte de la région, pas hors de la boîte', () => {
    expect(dansQuartier({ latitude: 45.505, longitude: -73.565 }, region)).toBe(true);
    expect(dansQuartier({ latitude: 45.52, longitude: -73.57 }, region)).toBe(false); // plus de 0,015 au nord
    expect(dansQuartier({ latitude: 45.5, longitude: -73.6 }, region)).toBe(false); // plus de 0,02 à l'ouest
    expect(dansQuartier({ latitude: 45.7, longitude: -73.5 }, REGION_DEMO)).toBe(false);
  });

  it('rayon de 400 m : étendue d’environ 800 m de côté', () => {
    expect(RAYON_CITOYEN_M).toBeGreaterThanOrEqual(300);
    expect(RAYON_CITOYEN_M).toBeLessThanOrEqual(500);
    const d = deltasPourRayon({ latitude: 45.5, longitude: -73.57 }, 400);
    expect(d.latitudeDelta * 110540).toBeCloseTo(800, 0);
    expect(d.longitudeDelta * 111320 * Math.cos((45.5 * Math.PI) / 180)).toBeCloseTo(800, 0);
  });

  it('messages : refusée, introuvable, hors quartier, rien sinon', () => {
    expect(messagePositionCarte('refusee', null, region)).toMatch(/refusée/);
    expect(messagePositionCarte('indisponible', null, region)).toMatch(/introuvable/);
    expect(messagePositionCarte('ok', { latitude: 48, longitude: -73 }, region)).toMatch(/hors du quartier/);
    expect(messagePositionCarte('ok', { latitude: 45.5, longitude: -73.57 }, region)).toBeNull();
    expect(messagePositionCarte('attente', null, region)).toBeNull();
  });
});
