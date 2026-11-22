import type { Arret, Tournee } from '../../types';
import { arretsTries, idArret, prochainArret, regionAutour, trouverTournee } from '../trajet';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const region = { latitude: 45.5, longitude: -73.56, latitudeDelta: 0.03, longitudeDelta: 0.04 };

function arret(rang: number, extra: Partial<Arret> = {}): Arret {
  return {
    rang, cle_endroit: `grille:${rang}`, signalement_ids: [`s${rang}`],
    position: { latitude: 45.5 + rang / 1000, longitude: -73.56 },
    arrivee_prevue: '2026-11-22T12:00:00+00:00', depart_prevu: '2026-11-22T12:05:00+00:00', ...extra,
  };
}

const tournee: Tournee = {
  equipe_id: 'e1', equipe_nom: 'Équipe 1', distance_m: 1, duree_s: 1,
  debut_prevu: '', fin_prevue: '', geometrie: null, arrets: [arret(3), arret(1), arret(2)],
};

describe('lib/trajet', () => {
  it('identifie un arrêt par son id, sinon par sa clé d’endroit', () => {
    expect(idArret(arret(1, { id: 'a1' }))).toBe('a1');
    expect(idArret(arret(1))).toBe('grille:1');
  });

  it('trie par rang et trouve le prochain arrêt non fait', () => {
    expect(arretsTries(tournee).map((a) => a.rang)).toEqual([1, 2, 3]);
    expect(prochainArret(tournee, () => false)?.rang).toBe(1);
    expect(prochainArret(tournee, (a) => a.rang < 3)?.rang).toBe(3);
    expect(prochainArret(tournee, () => true)).toBeNull();
  });

  it('trouve la tournée d’une équipe', () => {
    const resultat = { tournees: [tournee] } as never;
    expect(trouverTournee(resultat, 'e1')).toBe(tournee);
    expect(trouverTournee(resultat, 'autre')).toBeNull();
    expect(trouverTournee(null, 'e1')).toBeNull();
  });

  it('centre la carte sur les points, avec une marge', () => {
    const r = regionAutour(
      [{ latitude: 45.5, longitude: -73.6 }, { latitude: 45.52, longitude: -73.5 }],
      region,
    );
    expect(r.latitude).toBeCloseTo(45.51);
    expect(r.longitudeDelta).toBeGreaterThan(0.1);
    expect(regionAutour([], region)).toBe(region);
  });
});
