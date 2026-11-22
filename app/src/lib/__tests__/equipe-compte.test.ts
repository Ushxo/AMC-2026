import { associerCompte, dissocierCompte, lireMonEquipe, lirePositionsEquipes, messageCompte, envoyerPosition } from '../equipe-compte';
import { getSupabase } from '../supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../source', () => ({ avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p) }));

const client = (rpc: jest.Mock, from?: jest.Mock) => ({ rpc, from: from ?? jest.fn() });

describe('compte et position d’équipe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('messages lisibles pour les erreurs de la base', () => {
    expect(messageCompte({ message: 'Aucun compte avec ce courriel.' })).toContain('Aucun compte');
    expect(messageCompte({ message: 'Réservé aux superviseurs.' })).toBe('Réservé aux superviseurs.');
    expect(messageCompte({ message: 'Could not find the function public.associer_compte_equipe' })).toContain('pas encore disponible');
    expect(messageCompte({ message: 'autre chose' })).toContain('Réessayez');
  });

  it('associe un compte, refuse un courriel vide, et traduit les refus', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    (getSupabase as jest.Mock).mockReturnValue(client(rpc));
    expect(await associerCompte('  ', 'e1')).toContain('courriel');
    expect(rpc).not.toHaveBeenCalled();
    expect(await associerCompte(' equipe@exemple.ca ', 'e1')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('associer_compte_equipe', { p_courriel: 'equipe@exemple.ca', p_equipe: 'e1' });
    rpc.mockResolvedValue({ error: { message: 'Aucun compte avec ce courriel.' } });
    expect(await associerCompte('x@y.ca', 'e1')).toContain('Aucun compte');
    rpc.mockResolvedValue({ error: { message: 'Réservé aux superviseurs.' } });
    expect(await dissocierCompte('e1')).toBe('Réservé aux superviseurs.');
  });

  it('migration pas lancée : mon_equipe et les positions répondent sans planter', async () => {
    const absent = { code: 'PGRST202', message: 'Could not find the function public.mon_equipe' };
    const rpc = jest.fn().mockResolvedValue({ data: null, error: absent });
    const from = jest.fn(() => ({ select: async () => ({ data: null, error: { code: 'PGRST205', message: 'does not exist' } }) }));
    (getSupabase as jest.Mock).mockReturnValue(client(rpc, from));
    expect(await lireMonEquipe()).toEqual({ equipeId: null, disponible: false, echec: false });
    expect(await lirePositionsEquipes()).toBeNull();
  });

  it('panne de lecture (réseau, serveur) : echec vrai, distinct de « aucune équipe »', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { code: '500', message: 'panne' } });
    (getSupabase as jest.Mock).mockReturnValue(client(rpc, jest.fn()));
    expect(await lireMonEquipe()).toEqual({ equipeId: null, disponible: true, echec: true });
    (getSupabase as jest.Mock).mockReturnValue(client(jest.fn().mockRejectedValue(new Error('réseau')), jest.fn()));
    expect((await lireMonEquipe()).echec).toBe(true);
  });

  it('lit l’équipe du compte et les positions', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 'eq-1', error: null });
    const from = jest.fn(() => ({
      select: async () => ({
        data: [{ equipe_id: 'eq-1', latitude: 45.5, longitude: -73.57, cap: null, maj_le: '2026-11-22T12:00:00Z' }],
        error: null,
      }),
    }));
    (getSupabase as jest.Mock).mockReturnValue(client(rpc, from));
    expect(await lireMonEquipe()).toEqual({ equipeId: 'eq-1', disponible: true, echec: false });
    expect(await lirePositionsEquipes()).toEqual([
      { equipe_id: 'eq-1', position: { latitude: 45.5, longitude: -73.57 }, cap: null, maj_le: '2026-11-22T12:00:00Z' },
    ]);
  });

  it('envoie la position en remplaçant la ligne de l’équipe', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    (getSupabase as jest.Mock).mockReturnValue(client(jest.fn(), jest.fn(() => ({ upsert }))));
    expect(await envoyerPosition('eq-1', { latitude: 45.5, longitude: -73.57 }, -10)).toBe(true);
    const [ligne, options] = upsert.mock.calls[0];
    expect(ligne).toMatchObject({ equipe_id: 'eq-1', latitude: 45.5, longitude: -73.57, cap: 350 });
    expect(options).toEqual({ onConflict: 'equipe_id' });
    expect(ligne).not.toHaveProperty('maj_le');
    expect(ligne).not.toHaveProperty('compte_id');
    upsert.mockResolvedValue({ error: { message: 'refus' } });
    expect(await envoyerPosition('eq-1', { latitude: 45.5, longitude: -73.57 }, null)).toBe(false);
  });
});
