import { creerCompteCitoyen, MESSAGE_COMPTE_NON_CONFIGURE, ouvrirSession } from '../connexion';
import { MESSAGE_CONNEXION_REFUSEE, MESSAGE_CONNEXION_RESEAU } from '../messages';
import { citoyenCourant, definirCitoyen, definirEmploye, employeCourant, roleCourant } from '../session';
import { getSupabase } from '../supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));

const mockGet = getSupabase as jest.Mock;

/** Faux client : connexion réussie ou non, profil rendu par mon_profil. */
function faux(opts: { signIn?: { error: unknown }; profil?: Record<string, unknown> | null; rpcPanne?: boolean; signUpProfil?: Record<string, unknown> }) {
  const signOut = jest.fn(async () => ({ error: null }));
  const client = {
    auth: {
      signInWithPassword: jest.fn(async () => (opts.signIn?.error ? { data: null, error: opts.signIn.error } : { data: { user: { id: 'u1', email: 'a@b.ca' } }, error: null })),
      signOut,
      signUp: jest.fn(async () => ({ data: { session: {} }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: {} } })),
    },
    rpc: jest.fn(async (nom: string) => {
      if (opts.rpcPanne) return { data: null, error: { code: '500', message: 'panne' } };
      if (nom === 'mon_profil') return { data: opts.signUpProfil ?? opts.profil ?? null, error: null };
      return { data: null, error: { code: '42883', message: 'absente' } };
    }),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  };
  return { client, signOut };
}

beforeEach(() => {
  definirEmploye(null);
  definirCitoyen(null);
});

describe('connexion unique', () => {
  it('un citoyen est connecté comme citoyen (et pas déconnecté)', async () => {
    const f = faux({ profil: { id: 'u1', role: 'citoyen', poste: null, prenom: 'Ana', nom: 'Roy' } });
    mockGet.mockReturnValue(f.client);
    const r = await ouvrirSession('a@b.ca', 'secret123');
    expect(r).toEqual({ ok: true, ecran: 'citoyen' });
    expect(citoyenCourant()?.nom).toBe('Ana Roy');
    expect(employeCourant()).toBeNull();
    expect(f.signOut).not.toHaveBeenCalled();
  });

  it('un superviseur ouvre l’écran superviseur ; un employé simple l’écran employé', async () => {
    mockGet.mockReturnValue(faux({ profil: { id: 'u1', role: 'employe', poste: 'superviseur', prenom: 'S', nom: 'V' } }).client);
    expect(await ouvrirSession('a@b.ca', 'x')).toEqual({ ok: true, ecran: 'superviseur' });
    expect(roleCourant()).toBe('superviseur');
    definirEmploye(null);
    mockGet.mockReturnValue(faux({ profil: { id: 'u1', role: 'employe', poste: 'commis', prenom: 'E', nom: 'Q' } }).client);
    expect(await ouvrirSession('a@b.ca', 'x')).toEqual({ ok: true, ecran: 'employe' });
    expect(roleCourant()).toBe('employe');
  });

  it('mauvais mot de passe : message lisible ; réseau : message réseau', async () => {
    mockGet.mockReturnValue(faux({ signIn: { error: { name: 'AuthApiError' } } }).client);
    expect(await ouvrirSession('a@b.ca', 'mauvais')).toEqual({ ok: false, message: MESSAGE_CONNEXION_REFUSEE });
    mockGet.mockReturnValue(faux({ signIn: { error: { name: 'AuthRetryableFetchError' } } }).client);
    expect(await ouvrirSession('a@b.ca', 'x')).toEqual({ ok: false, message: MESSAGE_CONNEXION_RESEAU });
    mockGet.mockReturnValue(null);
    expect(await ouvrirSession('a@b.ca', 'x')).toEqual({ ok: false, message: MESSAGE_CONNEXION_RESEAU });
  });

  it('compte sans profil : déconnecté avec un message', async () => {
    const f = faux({ profil: null });
    mockGet.mockReturnValue(f.client);
    expect(await ouvrirSession('a@b.ca', 'x')).toEqual({ ok: false, message: MESSAGE_COMPTE_NON_CONFIGURE });
    expect(f.signOut).toHaveBeenCalled();
  });

  it('inscription citoyenne : connecté comme citoyen, ou message d’erreur', async () => {
    const f = faux({ signUpProfil: { id: 'u9', role: 'citoyen', poste: null, prenom: 'Léa', nom: null, created_at: '2026-11-22' } });
    mockGet.mockReturnValue(f.client);
    expect(await creerCompteCitoyen({ courriel: 'lea@b.ca', motDePasse: 'longmotdepasse', prenom: 'Léa' })).toBeNull();
    expect(citoyenCourant()?.user_id).toBe('u9');
    mockGet.mockReturnValue(null);
    expect(await creerCompteCitoyen({ courriel: 'x@b.ca', motDePasse: 'longmotdepasse' })).toBe(MESSAGE_CONNEXION_RESEAU);
  });
});
