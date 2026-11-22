import { act, renderHook } from '@testing-library/react-native';

import * as source from '../../lib/source';
import { useSignalements } from '../use-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../lib/source', () => ({
  abonnerChangements: jest.fn(() => () => {}),
  abonnerSignalementsRealtime: jest.fn(() => () => {}),
  etatSource: jest.fn(),
  lireSignalements: jest.fn(async () => []),
  renvoyerFile: jest.fn(async () => 0),
  sonderSource: jest.fn(),
}));
jest.mock('../../lib/file-attente', () => ({ lister: jest.fn(async () => []) }));

const m = source as unknown as Record<string, jest.Mock>;

describe('useSignalements : sonde en repli', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('hors ligne, sonde la connexion et relance le renvoi au retour du réseau', async () => {
    m.etatSource.mockReturnValue('repli');
    m.sonderSource.mockResolvedValue('repli');
    await renderHook(() => useSignalements());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(m.sonderSource).toHaveBeenCalled();
    const avant = m.renvoyerFile.mock.calls.length;

    m.sonderSource.mockResolvedValue('en_ligne');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(m.renvoyerFile.mock.calls.length).toBeGreaterThan(avant);
  });
});
