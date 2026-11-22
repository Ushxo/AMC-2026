import {
  abonnerStatutCanal,
  abonnerTable,
  canalConnecte,
  nombreCanauxOuverts,
  REGROUPEMENT_MS,
  GRACE_FERMETURE_MS,
  reinitialiserCanaux,
} from '../canal-partage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type Faux = { surEvenement: () => void; statut: (s: string) => void };
const canaux: Faux[] = [];
const removeChannel = jest.fn();
const mockClient = {
  channel: jest.fn(() => {
    const c: Faux & Record<string, unknown> = { surEvenement: () => {}, statut: () => {} };
    c.on = jest.fn((_t: string, _f: unknown, cb: () => void) => {
      c.surEvenement = cb;
      return c;
    });
    c.subscribe = jest.fn((cb: (s: string) => void) => {
      c.statut = cb;
      return c;
    });
    canaux.push(c);
    return c;
  }),
  removeChannel,
};
jest.mock('../supabase', () => ({ getSupabase: () => mockClient }));

describe('canal Realtime partagé', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    canaux.length = 0;
    removeChannel.mockClear();
    mockClient.channel.mockClear();
    reinitialiserCanaux();
  });
  afterEach(() => jest.useRealTimers());

  it('deux abonnés d’une même table partagent un seul canal, fermé au départ du dernier', () => {
    const a = abonnerTable('signalements', jest.fn());
    const b = abonnerTable('signalements', jest.fn());
    expect(mockClient.channel).toHaveBeenCalledTimes(1);
    expect(nombreCanauxOuverts()).toBe(1);
    a();
    expect(removeChannel).not.toHaveBeenCalled();
    b();
    expect(removeChannel).not.toHaveBeenCalled(); // délai de grâce
    jest.advanceTimersByTime(GRACE_FERMETURE_MS);
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(nombreCanauxOuverts()).toBe(0);
  });

  it('un abonné qui revient pendant le délai de grâce garde le même canal (changement d’onglet)', () => {
    const a = abonnerTable('signalements', jest.fn());
    a();
    jest.advanceTimersByTime(GRACE_FERMETURE_MS - 500);
    const b = abonnerTable('signalements', jest.fn());
    jest.advanceTimersByTime(GRACE_FERMETURE_MS * 2);
    expect(mockClient.channel).toHaveBeenCalledTimes(1);
    expect(removeChannel).not.toHaveBeenCalled();
    b();
    jest.advanceTimersByTime(GRACE_FERMETURE_MS);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('une table différente ouvre un autre canal', () => {
    abonnerTable('signalements', jest.fn());
    abonnerTable('positions_equipes', jest.fn());
    expect(mockClient.channel).toHaveBeenCalledTimes(2);
  });

  it('regroupe les événements rapprochés : une relecture au plus toutes les 300 ms', () => {
    const rappel = jest.fn();
    abonnerTable('signalements', rappel);
    const c = canaux[0];
    c.surEvenement(); // premier événement : tout de suite
    expect(rappel).toHaveBeenCalledTimes(1);
    c.surEvenement();
    c.surEvenement();
    c.surEvenement();
    expect(rappel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(REGROUPEMENT_MS);
    expect(rappel).toHaveBeenCalledTimes(2);
  });

  it('un désabonnement annule la relecture prévue', () => {
    const rappel = jest.fn();
    const stop = abonnerTable('signalements', rappel);
    canaux[0].surEvenement();
    canaux[0].surEvenement();
    stop();
    jest.advanceTimersByTime(1000);
    expect(rappel).toHaveBeenCalledTimes(1);
  });

  it('suit l’état de connexion et rattrape les changements à la reconnexion', () => {
    const rappel = jest.fn();
    const statut = jest.fn();
    abonnerTable('signalements', rappel);
    abonnerStatutCanal('signalements', statut);
    expect(canalConnecte('signalements')).toBe(false);
    canaux[0].statut('SUBSCRIBED');
    expect(canalConnecte('signalements')).toBe(true);
    expect(rappel).not.toHaveBeenCalled(); // première connexion : rien à rattraper
    canaux[0].statut('CLOSED');
    expect(canalConnecte('signalements')).toBe(false);
    jest.advanceTimersByTime(1000);
    canaux[0].statut('SUBSCRIBED');
    expect(rappel).toHaveBeenCalledTimes(1);
    expect(statut).toHaveBeenCalledTimes(3);
  });
});
