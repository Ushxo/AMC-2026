import { act, renderHook } from '@testing-library/react-native';

import * as optimisation from '../../lib/optimisation';
import { reinitialiserEtatTournees } from '../../lib/store-tournees';
import { usePassage } from '../use-passage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));
jest.mock('../../lib/source', () => ({
  etatSource: jest.fn(() => 'en_ligne'),
  abonnerEtat: jest.fn(() => () => {}),
  abonnerChangements: jest.fn(() => () => {}),
  abonnerSignalementsRealtime: jest.fn(() => () => {}),
  sonderSource: jest.fn(async () => 'en_ligne'),
  lireSignalements: jest.fn(async () => [
    { id: 'a', etat: 'nouveau', etat_change_le: 'x', cree_le: 'x' },
    { id: 'b', etat: 'nouveau', etat_change_le: 'x', cree_le: 'x' },
  ]),
  renvoyerFile: jest.fn(async () => 0),
}));
jest.mock('../../lib/file-attente', () => ({ lister: jest.fn(async () => []) }));
jest.mock('../../lib/optimisation', () => ({
  ...jest.requireActual('../../lib/optimisation'),
  lireArretPourSignalement: jest.fn(),
}));

const lire = optimisation.lireArretPourSignalement as jest.Mock;

function differe<T>() {
  let resoudre!: (v: T) => void;
  const promesse = new Promise<T>((r) => {
    resoudre = r;
  });
  return { promesse, resoudre };
}

const passage = (rang: number, heure: string) => ({ rang, arrivee_prevue: heure, depart_prevu: heure });

beforeEach(() => {
  jest.clearAllMocks();
  reinitialiserEtatTournees();
});

describe('usePassage : une réponse par signalement', () => {
  it('une réponse tardive de l’ancienne fiche ne remplace pas la nouvelle, et l’ancienne heure disparaît au changement', async () => {
    const a = differe<ReturnType<typeof passage> | null>();
    lire.mockImplementation((id: string) => (id === 'a' ? a.promesse : Promise.resolve(passage(2, '2026-11-22T13:00:00+00:00'))));

    const { result, rerender } = await renderHook(({ id }: { id: string }) => usePassage(id), {
      initialProps: { id: 'a' },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.suivi.etape).toBe('recu'); // la réponse de « a » n'est pas arrivée

    await rerender({ id: 'b' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.suivi).toMatchObject({ etape: 'planifie', rang: 2, heure_estimee: '8 h 00' });

    // La vieille réponse de « a » arrive après coup : elle est ignorée.
    await act(async () => {
      a.resoudre(passage(9, '2026-11-22T15:00:00+00:00'));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.suivi).toMatchObject({ etape: 'planifie', rang: 2 });
  });

  it('au changement de fiche, l’heure de l’ancien signalement n’est jamais montrée', async () => {
    const b = differe<ReturnType<typeof passage> | null>();
    lire.mockImplementation((id: string) => (id === 'a' ? Promise.resolve(passage(1, '2026-11-22T12:00:00+00:00')) : b.promesse));
    const { result, rerender } = await renderHook(({ id }: { id: string }) => usePassage(id), {
      initialProps: { id: 'a' },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.suivi.etape).toBe('planifie');
    await rerender({ id: 'b' });
    expect(result.current.suivi.etape).toBe('recu'); // pas l'heure de « a » en attendant « b »
    expect(result.current.suivi.heure_estimee).toBeNull();
  });
});
