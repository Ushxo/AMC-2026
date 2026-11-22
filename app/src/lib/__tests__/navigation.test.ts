import {
  capEntre,
  DELAI_MIN_ROUTE_MS,
  distanceAuTrace,
  distanceCourte,
  doitRecalculer,
  dureeCourte,
  ECART_RECALCUL_M,
} from '../navigation';

const A = { latitude: 45.5, longitude: -73.57 };

describe('navigation', () => {
  it('cap entre deux points', () => {
    expect(capEntre(A, { latitude: 45.51, longitude: -73.57 })).toBeCloseTo(0, 0);
    expect(capEntre(A, { latitude: 45.5, longitude: -73.56 })).toBeCloseTo(90, 0);
    expect(capEntre(A, { latitude: 45.49, longitude: -73.57 })).toBeCloseTo(180, 0);
    expect(capEntre(A, { latitude: 45.5, longitude: -73.58 })).toBeCloseTo(270, 0);
  });

  it('distance d’un point au tracé', () => {
    const trace = [A, { latitude: 45.5, longitude: -73.56 }];
    // 0,001 degré de latitude au nord du milieu du segment = environ 110 m
    const d = distanceAuTrace({ latitude: 45.501, longitude: -73.565 }, trace);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
    expect(distanceAuTrace({ latitude: 45.5, longitude: -73.565 }, trace)).toBeLessThan(1);
    expect(distanceAuTrace(A, [])).toBe(Infinity);
  });

  it('textes courts', () => {
    expect(distanceCourte(347)).toBe('350 m');
    expect(distanceCourte(1240)).toBe('1,2 km');
    expect(dureeCourte(100)).toBe('environ 2 min');
    expect(dureeCourte(10)).toBe('environ 1 min');
    expect(dureeCourte(4500)).toBe('environ 1 h 15');
  });

  it('route redemandée : au premier appel, au nouvel arrêt ou si on s’écarte, jamais plus d’une fois par 10 s', () => {
    const base = { dernierEnvoiMs: 0, maintenantMs: DELAI_MIN_ROUTE_MS + 1, arriveeChangee: false, ecartM: 0 };
    expect(doitRecalculer({ ...base, dernierEnvoiMs: null })).toBe(true);
    expect(doitRecalculer(base)).toBe(false);
    expect(doitRecalculer({ ...base, arriveeChangee: true })).toBe(true);
    expect(doitRecalculer({ ...base, ecartM: ECART_RECALCUL_M + 1 })).toBe(true);
    expect(doitRecalculer({ ...base, ecartM: ECART_RECALCUL_M - 1 })).toBe(false);
    expect(doitRecalculer({ ...base, maintenantMs: 5000, arriveeChangee: true, ecartM: 500 })).toBe(false);
  });
});
