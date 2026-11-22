import * as Location from 'expo-location';
import { act, renderHook } from '@testing-library/react-native';

import * as compte from '../../lib/equipe-compte';
import { usePositionSuivie } from '../use-position-suivie';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock('../../lib/equipe-compte', () => ({
  ...jest.requireActual('../../lib/equipe-compte'),
  envoyerPosition: jest.fn(async () => true),
}));

const L = Location as unknown as Record<string, jest.Mock>;
const envoyer = compte.envoyerPosition as jest.Mock;

function point(lat: number, lng: number, heading: number | null = null) {
  return { coords: { latitude: lat, longitude: lng, heading } };
}

describe('usePositionSuivie', () => {
  let rappel: (p: ReturnType<typeof point>) => void;
  const retirer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    L.watchPositionAsync.mockImplementation(async (_o, cb) => {
      rappel = cb;
      return { remove: retirer };
    });
  });
  afterEach(() => jest.useRealTimers());

  it('suit la position, déduit le cap du déplacement, envoie au plus toutes les 7 s, et s’arrête en quittant', async () => {
    const { result, unmount } = await renderHook(() => usePositionSuivie('eq-1', true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.autorisee).toBe(true);
    expect(result.current.partage).toBe('envoye');
    await act(async () => rappel(point(45.5, -73.57)));
    expect(result.current.position).toEqual({ latitude: 45.5, longitude: -73.57 });
    expect(envoyer).toHaveBeenCalledTimes(1);
    await act(async () => rappel(point(45.501, -73.57))); // vers le nord, moins de 7 s plus tard
    expect(result.current.cap).toBeCloseTo(0, 0);
    expect(envoyer).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 8000);
    await act(async () => rappel(point(45.502, -73.57, 90)));
    expect(result.current.cap).toBe(90);
    expect(envoyer).toHaveBeenCalledTimes(2);
    expect(envoyer).toHaveBeenLastCalledWith('eq-1', { latitude: 45.502, longitude: -73.57 }, 90);
    await unmount();
    expect(retirer).toHaveBeenCalled();
  });

  it('en démonstration : position locale, rien n’est envoyé', async () => {
    const { result } = await renderHook(() => usePositionSuivie('eq-1', false));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => rappel(point(45.5, -73.57)));
    expect(result.current.partage).toBe('local');
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('permission refusée : pas de position, pas d’envoi, pas de plantage', async () => {
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    const { result } = await renderHook(() => usePositionSuivie('eq-1', true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.autorisee).toBe(false);
    expect(result.current.position).toBeNull();
    expect(L.watchPositionAsync).not.toHaveBeenCalled();
  });
});
