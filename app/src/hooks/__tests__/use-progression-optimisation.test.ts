import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { DemandeOptimisation, StatutDemande } from '../../types';
import { useProgressionOptimisation } from '../use-progression-optimisation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function demande(statut: StatutDemande, id = 'd1'): DemandeOptimisation {
  return {
    id, cree_le: '2026-11-21T20:00:00Z', statut,
    parametres: { version: 1, equipe_ids: [], incident_ids: [], affectations_forcees: [], limite_secondes: 8 },
    message: null, commence_le: null, termine_le: null,
  };
}

describe('useProgressionOptimisation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('avance avec le temps, plafonne à 0,95, puis passe à 1 à la fin', async () => {
    const { result, rerender } = await renderHook(
      ({ d }: { d: DemandeOptimisation }) => useProgressionOptimisation(d),
      { initialProps: { d: demande('en_cours') } },
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const debut = result.current.fraction;
    expect(result.current.etape).toBe('en_cours');
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.fraction).toBeGreaterThan(debut);
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(result.current.fraction).toBeLessThanOrEqual(0.95);
    expect(result.current.fraction).toBeGreaterThan(0.9);
    await rerender({ d: demande('terminee') });
    expect(result.current.etape).toBe('terminee');
    expect(result.current.fraction).toBe(1);
    expect(result.current.libelle).toBe('Tournées prêtes');
  });

  it('avec la réduction des animations, la barre avance par paliers d’une seconde', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useProgressionOptimisation(demande('en_attente')));
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.reduireMouvement).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    const avant = result.current.fraction;
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.fraction).toBeGreaterThan(avant);
  });
});
