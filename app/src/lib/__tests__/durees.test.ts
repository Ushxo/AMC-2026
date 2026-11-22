import type { Arret } from '../../types';
import { libelleReste, resteEstime, resumeToutesEquipes, resumeTotalTournee } from '../durees';

const arret = (rang: number, arrivee: string, depart: string): Arret => ({
  rang,
  cle_endroit: `c${rang}`,
  signalement_ids: ['s'],
  position: { latitude: 45.5, longitude: -73.57 },
  arrivee_prevue: arrivee,
  depart_prevu: depart,
});

const t = {
  duree_s: 6 * 3600 + 52 * 60,
  distance_m: 19400,
  debut_prevu: '2026-11-22T12:00:00Z',
  fin_prevue: '2026-11-22T18:52:00Z',
  arrets: [
    arret(1, '2026-11-22T12:20:00Z', '2026-11-22T12:30:00Z'),
    arret(2, '2026-11-22T13:00:00Z', '2026-11-22T13:10:00Z'),
    arret(3, '2026-11-22T14:00:00Z', '2026-11-22T14:10:00Z'),
  ],
};

describe('durées de tournée', () => {
  it('résumé de la tournée', () => {
    expect(resumeTotalTournee(t)).toBe('Durée totale estimée : 6 h 52 · 19,4 km · 3 arrêts');
  });

  it('total toutes équipes : somme des durées, distances et arrêts', () => {
    expect(resumeToutesEquipes([t, t])).toBe('Total toutes équipes : 13 h 44 · 38,8 km · 6 arrêts (durées cumulées)');
  });

  it('reste estimé : depuis la fin du dernier arrêt fait, ou le début si rien n’est fait', () => {
    expect(resteEstime(t, () => false)).toEqual({ duree_s: 6 * 3600 + 52 * 60, arrets: 3 });
    const fait1 = (a: Arret) => a.rang === 1;
    // départ de l'arrêt 1 à 12:30, fin à 18:52 : 6 h 22
    expect(resteEstime(t, fait1)).toEqual({ duree_s: 6 * 3600 + 22 * 60, arrets: 2 });
    expect(libelleReste(resteEstime(t, fait1))).toBe('Reste (estimé) : 6 h 22 · 2 arrêts');
  });

  it('tout fait : zéro ; un arrêt sauté suit le premier restant', () => {
    expect(resteEstime(t, () => true)).toEqual({ duree_s: 0, arrets: 0 });
    // 1 et 3 faits, 2 restant : le départ de référence est celui de l'arrêt 1
    expect(resteEstime(t, (a) => a.rang !== 2).arrets).toBe(1);
  });
});
