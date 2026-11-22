import { lireArretPourSignalement } from '../optimisation';
import { getSupabase } from '../supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../source', () => ({ avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p) }));

const mockGet = getSupabase as jest.Mock;

function client(rpc: { data?: unknown; error?: unknown }, arrets?: { data?: unknown[]; error?: unknown }) {
  const appels: string[] = [];
  return {
    appels,
    c: {
      rpc: jest.fn(async () => rpc),
      from: jest.fn((table: string) => {
        appels.push(table);
        return { select: () => ({ contains: () => ({ limit: async () => arrets ?? { data: [], error: null } }) }) };
      }),
    },
  };
}

const ligne = { rang: 3, arrivee_prevue: '2026-11-22T12:08:00+00:00', depart_prevu: '2026-11-22T12:16:00+00:00', fait: false };

describe('lireArretPourSignalement', () => {
  it('passage_signalement d’abord : rang et heures seulement', async () => {
    const k = client({ data: [ligne], error: null });
    mockGet.mockReturnValue(k.c);
    expect(await lireArretPourSignalement('s1')).toEqual({ ...ligne });
    expect(k.appels).toEqual([]); // aucune lecture directe des arrêts
    expect(k.c.rpc).toHaveBeenCalledWith('passage_signalement', { p_signalement: 's1' });
  });

  it('aucun passage : null', async () => {
    mockGet.mockReturnValue(client({ data: [], error: null }).c);
    expect(await lireArretPourSignalement('s1')).toBeNull();
  });

  it('fonction absente (avant la 0004) : repli sur la lecture des arrêts, sans tri sur cree_le', async () => {
    const k = client({ error: { code: 'PGRST202', message: 'Could not find the function' } }, { data: [{ ...ligne, rang: 7 }] });
    mockGet.mockReturnValue(k.c);
    expect((await lireArretPourSignalement('s1'))?.rang).toBe(7);
    expect(k.appels).toEqual(['arrets']);
  });

  it('une vraie panne est propagée (jamais prise pour « pas de passage »)', async () => {
    mockGet.mockReturnValue(client({ error: { message: 'Network request failed' } }).c);
    await expect(lireArretPourSignalement('s1')).rejects.toBeTruthy();
  });
});
