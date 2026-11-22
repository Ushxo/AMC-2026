import { AppState } from 'react-native';

import { abonnerTable, reinitialiserCanaux } from '../canal-partage';
import { demarrerReleve, RELEVE_LENTE_MS, RELEVE_RAPIDE_MS } from '../releve';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let statut: (s: string) => void = () => {};
const mockClient = {
  channel: jest.fn(() => {
    const c: Record<string, unknown> = {};
    c.on = jest.fn(() => c);
    c.subscribe = jest.fn((cb: (s: string) => void) => {
      statut = cb;
      return c;
    });
    return c;
  }),
  removeChannel: jest.fn(),
};
jest.mock('../supabase', () => ({ getSupabase: () => mockClient }));

describe('relève périodique', () => {
  let changement: (e: string) => void = () => {};
  beforeEach(() => {
    jest.useFakeTimers();
    reinitialiserCanaux();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_n: string, f: (e: string) => void) => {
      changement = f;
      return { remove: jest.fn() };
    }) as never);
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rapide quand le canal n’est pas connecté', () => {
    const lire = jest.fn();
    const arret = demarrerReleve({ table: 't1', lire });
    jest.advanceTimersByTime(RELEVE_RAPIDE_MS * 3);
    expect(lire).toHaveBeenCalledTimes(3);
    arret();
  });

  it('lente quand le canal est connecté, et repasse en rapide s’il se coupe', () => {
    const lire = jest.fn();
    const arretCanal = abonnerTable('t2', jest.fn());
    statut('SUBSCRIBED');
    const arret = demarrerReleve({ table: 't2', lire });
    jest.advanceTimersByTime(RELEVE_RAPIDE_MS * 3);
    expect(lire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(RELEVE_LENTE_MS);
    expect(lire).toHaveBeenCalledTimes(1);
    statut('CLOSED'); // coupé : on replanifie en rapide
    lire.mockClear();
    jest.advanceTimersByTime(RELEVE_RAPIDE_MS);
    expect(lire).toHaveBeenCalledTimes(1);
    arret();
    arretCanal();
  });

  it('s’arrête en arrière-plan et relit tout de suite au retour', () => {
    const lire = jest.fn();
    const arret = demarrerReleve({ table: 't3', lire });
    changement('background');
    jest.advanceTimersByTime(RELEVE_LENTE_MS * 2);
    expect(lire).not.toHaveBeenCalled();
    changement('active');
    expect(lire).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(RELEVE_RAPIDE_MS);
    expect(lire).toHaveBeenCalledTimes(2);
    arret();
    jest.advanceTimersByTime(RELEVE_LENTE_MS);
    expect(lire).toHaveBeenCalledTimes(2);
  });
});
