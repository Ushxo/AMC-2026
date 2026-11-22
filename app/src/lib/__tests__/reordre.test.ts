import type { Arret } from '../../types';
import { longueurChemin, ordreEstime, proposerRecalcul, reordonnerRestants, SEUIL_RECALCUL_M } from '../reordre';

const M = 1 / 110540;
const pt = (nord: number, est = 0) => ({ latitude: 45.5 + nord * M, longitude: -73.57 + (est * M) / 0.7 });
const arret = (rang: number, nord: number, est = 0): Arret => ({
  rang,
  cle_endroit: `c${rang}`,
  signalement_ids: ['s'],
  position: pt(nord, est),
  arrivee_prevue: '2026-11-22T12:00:00Z',
  depart_prevu: '2026-11-22T12:10:00Z',
});

describe('réordonner les arrêts restants', () => {
  it('range des points alignés du plus proche au plus loin', () => {
    const points = [pt(900), pt(100), pt(500), pt(300)];
    expect(ordreEstime(pt(0), points)).toEqual([1, 3, 2, 0]);
  });

  it('2-opt : le chemin n’est jamais plus long que le plus proche voisin seul, et garde chaque point une fois', () => {
    const points = Array.from({ length: 14 }, (_, i) => pt(((i * 37) % 11) * 120, ((i * 53) % 7) * 140));
    const ordre = ordreEstime(pt(0), points);
    expect([...ordre].sort((a, b) => a - b)).toEqual(points.map((_, i) => i));
    const plusProche = (() => {
      const reste = points.map((_, i) => i);
      const o: number[] = [];
      let c = pt(0);
      while (reste.length) {
        let m = 0;
        reste.forEach((r, k) => {
          if (Math.hypot(points[r].latitude - c.latitude, (points[r].longitude - c.longitude) * 0.7) < Math.hypot(points[reste[m]].latitude - c.latitude, (points[reste[m]].longitude - c.longitude) * 0.7)) m = k;
        });
        const [i] = reste.splice(m, 1);
        o.push(i);
        c = points[i];
      }
      return o;
    })();
    const L = (o: number[]) => longueurChemin(pt(0), o.map((i) => points[i]));
    expect(L(ordre)).toBeLessThanOrEqual(L(plusProche) + 1);
  });

  it('reordonnerRestants rend les mêmes arrêts dans le nouvel ordre', () => {
    const restants = [arret(5, 900), arret(6, 100), arret(7, 500)];
    expect(reordonnerRestants(pt(0), restants).map((a) => a.rang)).toEqual([6, 7, 5]);
  });

  it('proposer le recalcul : loin du premier arrêt et un autre plus proche', () => {
    expect(SEUIL_RECALCUL_M).toBe(300);
    const restants = [arret(1, 1500), arret(2, 400), arret(3, 900)];
    expect(proposerRecalcul(pt(0), restants)).toBe(true);
    expect(proposerRecalcul(pt(1300), restants)).toBe(false); // à 200 m du premier
    expect(proposerRecalcul(pt(0), [arret(1, 400), arret(2, 1500)])).toBe(false); // le premier est le plus proche
    expect(proposerRecalcul(null, restants)).toBe(false);
    expect(proposerRecalcul(pt(0), [arret(1, 1500)])).toBe(false);
  });
});
