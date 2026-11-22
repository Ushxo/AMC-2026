import { REGION_DEMO } from '../config';
import { dansQuartier, decisionCentrage, deltasPourRayon, distanceMetres, messagePositionCarte, RAYON_CITOYEN_M, regionDeDepart } from '../position-citoyen';

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

describe('ouverture centrée sur le citoyen', () => {
  const ici = { latitude: 45.5, longitude: -73.57 };
  const base = { region, cadreeSur: null, geste: false, affine: false };

  it('région de départ : sur le citoyen (rayon de quartier) s’il est dans la zone, sinon la zone', () => {
    const r = regionDeDepart(ici, region);
    expect(r.latitude).toBe(ici.latitude);
    expect(r.latitudeDelta * 110540).toBeCloseTo(2 * RAYON_CITOYEN_M, 0);
    expect(regionDeDepart({ latitude: 48, longitude: -73 }, region)).toBe(region); // hors zone
    expect(regionDeDepart(null, region)).toBe(region); // refus ou position introuvable
  });

  it('première position dans la zone : on centre ; hors zone ou inconnue : rien', () => {
    expect(decisionCentrage({ ...base, position: ici })).toBe('centrer');
    expect(decisionCentrage({ ...base, position: { latitude: 48, longitude: -73 } })).toBe('rien');
    expect(decisionCentrage({ ...base, position: null })).toBe('rien');
  });

  it('position fraîche : aucun saut si elle est proche, un seul affinage si elle est loin', () => {
    const proche = { latitude: ici.latitude + 0.0001, longitude: ici.longitude }; // environ 11 m
    const loin = { latitude: ici.latitude + 0.002, longitude: ici.longitude }; // environ 220 m
    expect(distanceMetres(ici, proche)).toBeLessThan(40);
    expect(decisionCentrage({ ...base, position: proche, cadreeSur: ici })).toBe('rien');
    expect(decisionCentrage({ ...base, position: loin, cadreeSur: ici })).toBe('affiner');
    expect(decisionCentrage({ ...base, position: loin, cadreeSur: ici, affine: true })).toBe('rien');
  });

  it('jamais de recentrage après un geste de l’utilisateur', () => {
    expect(decisionCentrage({ ...base, position: ici, geste: true })).toBe('rien');
    expect(decisionCentrage({ ...base, position: { latitude: 45.51, longitude: -73.57 }, cadreeSur: ici, geste: true })).toBe('rien');
  });
});
