import {
  estRefusOuAbsent,
  normaliserProfil,
  restaurerSession,
  roleDepuisProfil,
  surveillerSession,
} from '../auth';
import { avertissementSession, citoyenCourant, definirAvertissement, definirCitoyen, definirEmploye, employeCourant, peutGerer, roleCourant } from '../session';
import { getSupabase } from '../supabase';

jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));

const mockGet = getSupabase as jest.Mock;

function client(opts: {
  session: boolean;
  employe: boolean;
  panne?: boolean;
  profil?: Record<string, unknown> | null;
  rpc?: Record<string, { data?: unknown; error?: unknown }>;
}) {
  const signOut = jest.fn(async () => ({}));
  let rappel: ((e: string, session?: unknown) => void) | undefined;
  return {
    signOut,
    declencher: (e: string, session?: unknown) => rappel?.(e, session),
    c: {
      auth: {
        getSession: async () => ({ data: { session: opts.session ? { user: { id: 'u1', email: 'a@b.ca' } } : null } }),
        signOut,
        onAuthStateChange: (f: (e: string, session?: unknown) => void) => {
          rappel = f;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      },
      rpc: async (nom: string) => opts.rpc?.[nom] ?? { data: null, error: { code: '42883', message: 'fonction absente' } },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (opts.panne) return { data: null, error: { message: 'panne' } };
              if (table === 'profils') return { data: opts.profil ?? null, error: null };
              return { data: opts.employe ? { user_id: 'u1', nom: 'Employée' } : null, error: null };
            },
          }),
        }),
      }),
    },
  };
}

beforeEach(() => {
  definirEmploye(null);
  definirAvertissement(null);
});

describe('session employé', () => {
  it('reprend la session d’un employé', async () => {
    mockGet.mockReturnValue(client({ session: true, employe: true }).c);
    await restaurerSession();
    expect(employeCourant()?.nom).toBe('Employée');
    expect(avertissementSession()).toBeNull();
  });

  it('compte absent de la table employes : déconnecté avec un message clair', async () => {
    const k = client({ session: true, employe: false });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(employeCourant()).toBeNull();
    expect(k.signOut).toHaveBeenCalled();
    expect(avertissementSession()).toBe("Ce compte n'a pas accès au mode Ville.");
  });

  it('session expirée : retour à la connexion avec un message', async () => {
    const k = client({ session: true, employe: true });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    surveillerSession();
    k.declencher('SIGNED_OUT');
    expect(employeCourant()).toBeNull();
    expect(avertissementSession()).toBe('Votre session a expiré. Connectez-vous de nouveau.');
  });

  it('panne de lecture de employes : session gardée, message de panne, pas de « pas employé »', async () => {
    const k = client({ session: true, employe: false, panne: true });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(k.signOut).not.toHaveBeenCalled();
    expect(avertissementSession()).toBe('Le service est indisponible pour le moment. Réessayez dans un instant.');
  });

  it('sans clés Supabase : rien ne plante', async () => {
    mockGet.mockReturnValue(null);
    await restaurerSession();
    expect(typeof surveillerSession()).toBe('function');
    expect(employeCourant()).toBeNull();
  });
});

describe('rôles (table profils)', () => {
  it('roleDepuisProfil', () => {
    expect(roleDepuisProfil('admin', null)).toBe('admin');
    expect(roleDepuisProfil('employe', 'superviseur')).toBe('superviseur');
    expect(roleDepuisProfil('employe', 'commis')).toBe('employe');
    expect(roleDepuisProfil('employe', null)).toBe('employe');
    expect(roleDepuisProfil('citoyen', null)).toBeNull();
    expect(roleDepuisProfil(undefined, undefined)).toBeNull();
  });

  it('superviseur, employé simple, admin : rôle effectif et nom du profil', async () => {
    for (const [profil, attendu, gere] of [
      [{ role: 'employe', poste: 'superviseur', prenom: 'Ana', nom: 'Roy' }, 'superviseur', true],
      [{ role: 'employe', poste: 'commis', prenom: 'Ana', nom: 'Roy' }, 'employe', false],
      [{ role: 'admin', poste: null, prenom: 'Ana', nom: 'Roy' }, 'admin', true],
    ] as const) {
      definirEmploye(null);
      mockGet.mockReturnValue(client({ session: true, employe: false, profil }).c);
      await restaurerSession();
      expect(roleCourant()).toBe(attendu);
      expect(peutGerer(roleCourant())).toBe(gere);
      expect(employeCourant()?.nom).toBe('Ana Roy');
    }
  });

  it('compte de la table employes seule : superviseur', async () => {
    mockGet.mockReturnValue(client({ session: true, employe: true }).c);
    await restaurerSession();
    expect(roleCourant()).toBe('superviseur');
  });

  it('profil citoyen sans ligne employes : pas d\'accès au mode Ville, mais la session citoyen est gardée', async () => {
    definirCitoyen(null);
    const k = client({ session: true, employe: false, profil: { role: 'citoyen', poste: null } });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(employeCourant()).toBeNull();
    expect(citoyenCourant()?.courriel).toBeDefined();
    expect(k.signOut).not.toHaveBeenCalled();
    expect(avertissementSession()).toBeNull();
    definirCitoyen(null);
  });

  it('démonstration hors ligne : superviseur simulé', () => {
    definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
    expect(roleCourant()).toBe('superviseur');
    definirEmploye(null);
    expect(roleCourant()).toBeNull();
  });

  it("une connexion faite par un autre écran est reprise (SIGNED_IN)", async () => {
    jest.useFakeTimers();
    try {
      const k = client({ session: false, employe: false, profil: { role: 'employe', poste: 'superviseur', prenom: 'A', nom: 'B' } });
      mockGet.mockReturnValue(k.c);
      surveillerSession();
      (k as unknown as { declencher: (e: string, s?: unknown) => void }).declencher('SIGNED_IN', { user: { id: 'u1', email: 'a@b.ca' } });
      await jest.advanceTimersByTimeAsync(10);
      expect(roleCourant()).toBe('superviseur');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('profil : rpc d\u2019abord, puis table, puis employes', () => {
  it('normaliserProfil accepte objet, liste ou texte, sans planter sur le reste', () => {
    expect(normaliserProfil({ role: 'admin', poste: null, prenom: 'A', nom: 'B', extra: 1 })).toMatchObject({ role: 'admin' });
    expect(normaliserProfil([{ role: 'employe', poste: 'superviseur' }])).toMatchObject({ poste: 'superviseur' });
    expect(normaliserProfil('employe')).toEqual({ role: 'employe' });
    expect(normaliserProfil(null)).toBeNull();
    expect(normaliserProfil(42)).toBeNull();
    expect(normaliserProfil([])).toBeNull();
  });

  it('estRefusOuAbsent : refus et fonction absente, pas une panne', () => {
    expect(estRefusOuAbsent({ code: '42501' })).toBe(true);
    expect(estRefusOuAbsent({ status: 401 })).toBe(true);
    expect(estRefusOuAbsent({ code: 'PGRST202', message: 'x' })).toBe(true);
    expect(estRefusOuAbsent({ message: 'permission denied for table profils' })).toBe(true);
    expect(estRefusOuAbsent({ message: 'Network request failed' })).toBe(false);
    expect(estRefusOuAbsent(null)).toBe(false);
  });

  it('rpc mon_profil en objet : superviseur', async () => {
    mockGet.mockReturnValue(
      client({ session: true, employe: false, rpc: { mon_profil: { data: { role: 'employe', poste: 'superviseur', prenom: 'Ana', nom: 'Roy' } } } }).c,
    );
    await restaurerSession();
    expect(roleCourant()).toBe('superviseur');
    expect(employeCourant()?.nom).toBe('Ana Roy');
  });

  it('rpc mon_profil en liste, ou mon_role en texte', async () => {
    mockGet.mockReturnValue(client({ session: true, employe: false, rpc: { mon_profil: { data: [{ role: 'admin' }] } } }).c);
    await restaurerSession();
    expect(roleCourant()).toBe('admin');
    definirEmploye(null);
    mockGet.mockReturnValue(client({ session: true, employe: false, rpc: { mon_role: { data: 'employe' } } }).c);
    await restaurerSession();
    expect(roleCourant()).toBe('employe');
  });

  it('forme inattendue : on passe à la table profils puis à employes sans planter', async () => {
    mockGet.mockReturnValue(
      client({ session: true, employe: true, rpc: { mon_profil: { data: { n: 'inattendu' } }, mon_role: { data: 12 } } }).c,
    );
    await restaurerSession();
    expect(roleCourant()).toBe('superviseur');
  });

  it('rpc refusée (401) : on continue ; panne réseau de la rpc : session gardée, message de panne', async () => {
    mockGet.mockReturnValue(
      client({ session: true, employe: false, profil: { role: 'admin' }, rpc: { mon_profil: { error: { status: 401 } }, mon_role: { error: { status: 401 } } } }).c,
    );
    await restaurerSession();
    expect(roleCourant()).toBe('admin');
    definirEmploye(null);
    const k = client({ session: true, employe: false, rpc: { mon_profil: { error: { message: 'Network request failed' } } } });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(employeCourant()).toBeNull();
    expect(k.signOut).not.toHaveBeenCalled();
    expect(avertissementSession()).toBe('Le service est indisponible pour le moment. Réessayez dans un instant.');
  });
});

describe('priorité du profil sur la table employes', () => {
  it('un profil citoyen décide, même avec une ancienne ligne dans employes', async () => {
    definirCitoyen(null);
    const k = client({ session: true, employe: true, profil: { role: 'citoyen', poste: null } });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(employeCourant()).toBeNull(); // pas employé
    expect(citoyenCourant()).not.toBeNull(); // citoyen connecté
    definirCitoyen(null);
  });

  it('rpc qui répond citoyen : refusé sans consulter employes', async () => {
    const k = client({ session: true, employe: true, rpc: { mon_role: { data: 'citoyen' } } });
    mockGet.mockReturnValue(k.c);
    await restaurerSession();
    expect(employeCourant()).toBeNull();
  });

  it('rôle « superviseur » direct dans le profil', async () => {
    mockGet.mockReturnValue(client({ session: true, employe: false, profil: { role: 'superviseur' } }).c);
    await restaurerSession();
    expect(roleCourant()).toBe('superviseur');
  });

  it('compte SANS profil mais dans employes : superviseur de démonstration', async () => {
    mockGet.mockReturnValue(client({ session: true, employe: true, profil: null }).c);
    await restaurerSession();
    expect(roleCourant()).toBe('superviseur');
  });
});
