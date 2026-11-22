import { act, renderHook } from '@testing-library/react-native';

import * as canal from '../../lib/canal-partage';
import * as optimisation from '../../lib/optimisation';
import * as source from '../../lib/source';
import { reinitialiserEtatTournees } from '../../lib/store-tournees';
import { useTournees } from '../use-tournees';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));
jest.mock('../../lib/canal-partage', () => ({
  abonnerTable: jest.fn(() => () => {}),
  abonnerStatutCanal: jest.fn(() => () => {}),
  canalConnecte: jest.fn(() => true),
}));
jest.mock('../../lib/source', () => ({
  etatSource: jest.fn(() => 'en_ligne'),
  abonnerEtat: jest.fn(() => () => {}),
  abonnerChangements: jest.fn(() => () => {}),
  sonderSource: jest.fn(async () => 'en_ligne'),
  avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p),
}));
jest.mock('../../lib/optimisation', () => ({
  ...jest.requireActual('../../lib/optimisation'),
  lireDerniereTerminee: jest.fn(async () => null),
  abonnerDemandes: jest.fn(() => () => {}),
}));

const tables = canal.abonnerTable as jest.Mock;
const lire = optimisation.lireDerniereTerminee as jest.Mock;

describe('useTournees : suit aussi les arrêts et les tournées', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    reinitialiserEtatTournees();
    (source.etatSource as jest.Mock).mockReturnValue('en_ligne');
  });
  afterEach(() => jest.useRealTimers());

  it('un changement sur la table des arrêts relance la lecture sans attendre la relève de 30 s', async () => {
    const { unmount } = await renderHook(() => useTournees());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    const abonnees = tables.mock.calls.map((c) => c[0]);
    expect(abonnees).toEqual(expect.arrayContaining(['arrets', 'tournees']));
    const avant = lire.mock.calls.length;
    const surArrets = tables.mock.calls.find((c) => c[0] === 'arrets')![1] as () => void;
    await act(async () => {
      surArrets();
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(lire.mock.calls.length).toBeGreaterThan(avant);
    await unmount();
  });

  it('au démontage, les abonnements sont tous arrêtés', async () => {
    const arret = jest.fn();
    tables.mockReturnValue(arret);
    const { unmount } = await renderHook(() => useTournees());
    await unmount();
    expect(arret).toHaveBeenCalledTimes(2);
  });
});
