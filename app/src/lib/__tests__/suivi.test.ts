import type { ResultatOptimisation } from '../../types';
import { calculerSuivi, trouverArret } from '../suivi';

const arret = { rang: 3, arrivee_prevue: '2026-11-22T08:08:00-05:00' };
const nouveau = { etat: 'nouveau' as const, etat_change_le: '2026-11-20T10:00:00Z', cree_le: '2026-11-20T10:00:00Z' };

describe('calculerSuivi', () => {
  it('reçu sans arrêt', () => {
    expect(calculerSuivi(nouveau, null, false)).toMatchObject({ etape: 'recu', heure_estimee: null, rang: null });
  });

  it('planifié avec l’heure arrondie au quart d’heure et le rang', () => {
    expect(calculerSuivi(nouveau, arret, true, '2026-11-21T20:00:00Z')).toEqual({
      etape: 'planifie',
      heure_estimee: '8 h 15',
      rang: 3,
      depuis: '2026-11-21T20:00:00Z',
      precalcule: true,
    });
  });

  it("l'état du signalement passe avant la planification", () => {
    for (const etat of ['pris_en_charge', 'regle', 'rejete'] as const) {
      const s = calculerSuivi({ ...nouveau, etat }, arret, false);
      expect(s.etape).toBe(etat);
      expect(s.heure_estimee).toBeNull();
      expect(s.rang).toBeNull();
    }
  });

  it('signalement inconnu : reçu', () => {
    expect(calculerSuivi(null, null, false).etape).toBe('recu');
  });
});

describe('trouverArret', () => {
  const r = {
    tournees: [{ arrets: [{ rang: 1, signalement_ids: ['a'] }, { rang: 2, signalement_ids: ['b', 'c'] }] }],
  } as unknown as ResultatOptimisation;
  it('cherche dans toutes les tournées', () => {
    expect(trouverArret(r, 'c')?.rang).toBe(2);
    expect(trouverArret(r, 'z')).toBeNull();
    expect(trouverArret(null, 'a')).toBeNull();
  });
});
