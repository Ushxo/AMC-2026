import { act, renderHook } from '@testing-library/react-native';

import * as source from '../../lib/source';
import {
  nombreAbonnesSignalements,
  reinitialiserStoreSignalements,
} from '../../lib/store-signalements';
import type { Signalement } from '../../types';
import { useSignalements } from '../use-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockArretRealtime = jest.fn();
jest.mock('../../lib/source', () => ({
  abonnerChangements: jest.fn(() => () => {}),
  abonnerSignalementsRealtime: jest.fn(() => mockArretRealtime),
  etatSource: jest.fn(() => 'en_ligne'),
  lireSignalements: jest.fn(),
  renvoyerFile: jest.fn(async () => 0),
  sonderSource: jest.fn(),
}));
jest.mock('../../lib/file-attente', () => ({ lister: jest.fn(async () => []) }));

const m = source as unknown as Record<string, jest.Mock>;
const sig = (id: string): Signalement =>
  ({ id, etat: 'nouveau', gravite: 1, categorie: 'grille', latitude: 45.5, longitude: -73.5 }) as unknown as Signalement;

describe('magasin partagé des signalements', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    reinitialiserStoreSignalements();
    m.etatSource.mockReturnValue('en_ligne');
    m.lireSignalements.mockResolvedValue([sig('a'), sig('b')]);
  });
  afterEach(() => jest.useRealTimers());

  it('deux écrans montés : une seule lecture, un seul abonnement Realtime', async () => {
    const un = await renderHook(() => useSignalements());
    const deux = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(m.lireSignalements).toHaveBeenCalledTimes(1);
    expect(m.abonnerSignalementsRealtime).toHaveBeenCalledTimes(1);
    expect(un.result.current.signalements).toHaveLength(2);
    expect(deux.result.current.signalements).toHaveLength(2);
    expect(nombreAbonnesSignalements()).toBe(2);
  });

  it('un nouvel écran reçoit le cache tout de suite, sans « chargement », et ne relit pas', async () => {
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(un.result.current.chargement).toBe(false);
    const deux = await renderHook(() => useSignalements());
    expect(deux.result.current.chargement).toBe(false);
    expect(deux.result.current.signalements).toHaveLength(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(m.lireSignalements).toHaveBeenCalledTimes(1);
  });

  it('après un changement d’onglet (plus d’abonné), le cache est rendu puis relu en arrière-plan', async () => {
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    await un.unmount();
    expect(mockArretRealtime).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    m.lireSignalements.mockResolvedValue([sig('a'), sig('b'), sig('c')]);
    const deux = await renderHook(() => useSignalements());
    expect(deux.result.current.chargement).toBe(false);
    expect(deux.result.current.signalements).toHaveLength(2); // le cache d'abord
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(deux.result.current.signalements).toHaveLength(3); // puis la relecture
  });

  it('une lecture en cours est partagée, et un changement reçu pendant la lecture déclenche un seul rattrapage', async () => {
    let fin: (v: Signalement[]) => void = () => {};
    m.lireSignalements.mockImplementationOnce(() => new Promise<Signalement[]>((r) => (fin = r)));
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    const p1 = un.result.current.rafraichir();
    const p2 = un.result.current.rafraichir();
    const p3 = un.result.current.rafraichir();
    await act(async () => {
      fin([sig('a')]);
      await Promise.all([p1, p2, p3]);
    });
    expect(m.lireSignalements).toHaveBeenCalledTimes(2); // la lecture + un seul rattrapage
  });

  it('le dernier écran qui part arrête le canal et les minuteurs', async () => {
    const un = await renderHook(() => useSignalements());
    const deux = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    await un.unmount();
    expect(mockArretRealtime).not.toHaveBeenCalled();
    await deux.unmount();
    expect(mockArretRealtime).toHaveBeenCalledTimes(1);
    const lectures = m.lireSignalements.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120000);
    });
    expect(m.lireSignalements.mock.calls.length).toBe(lectures);
    expect(m.sonderSource).not.toHaveBeenCalled();
  });

  it('hors ligne : la lecture bascule sur la copie locale et la sonde reste active', async () => {
    m.etatSource.mockReturnValue('repli');
    m.sonderSource.mockResolvedValue('repli');
    m.lireSignalements.mockResolvedValue([sig('local')]);
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(un.result.current.signalements.map((s) => s.id)).toEqual(['local']);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(m.sonderSource).toHaveBeenCalledTimes(1);
  });

  it('une lecture qui échoue donne une erreur, sans effacer ce qu’on avait', async () => {
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    m.lireSignalements.mockRejectedValue(new Error('x'));
    await act(async () => {
      await un.result.current.rafraichir();
    });
    expect(un.result.current.erreur).not.toBeNull();
    expect(un.result.current.signalements).toHaveLength(2);
  });

  it('relève lente (30 s) quand le canal est connecté', async () => {
    await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(m.lireSignalements).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    // canal non connecté dans ce test (source simulée) : repli à 10 s
    expect(m.lireSignalements).toHaveBeenCalledTimes(2);
  });

  it('un renvoi de la file lent ne bloque pas l’affichage, et une relecture suit quand il réussit', async () => {
    let fini: (n: number) => void = () => {};
    m.renvoyerFile.mockImplementationOnce(() => new Promise<number>((r) => (fini = r)));
    const un = await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(un.result.current.chargement).toBe(false);
    expect(un.result.current.signalements).toHaveLength(2);
    expect(m.lireSignalements).toHaveBeenCalledTimes(1);
    await act(async () => {
      fini(1);
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(m.lireSignalements).toHaveBeenCalledTimes(2);
  });
});
