import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { DemandeOptimisation } from '@/types';
import { BarreProgressionCalcul } from '../barre-progression';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const demande: DemandeOptimisation = {
  id: 'd1',
  cree_le: '2026-11-21T20:00:00Z',
  statut: 'en_cours',
  parametres: { version: 1, equipe_ids: [], incident_ids: [], affectations_forcees: [], limite_secondes: 8 },
  message: null,
  commence_le: null,
  termine_le: null,
};

describe('barre de progression branchée sur la demande', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('avance toute seule avec le temps, sans que l’écran qui l’affiche ne se redessine', async () => {
    let rendusParent = 0;
    function Parent() {
      rendusParent++;
      return <BarreProgressionCalcul demande={demande} />;
    }
    await render(<Parent />);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const avant = rendusParent;
    expect(screen.getByLabelText('Calcul des tournées : Calcul en cours')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(rendusParent).toBe(avant);
    expect(screen.getByLabelText('Calcul des tournées : Calcul en cours').props.accessibilityValue.now).toBeGreaterThan(30);
  });
});
