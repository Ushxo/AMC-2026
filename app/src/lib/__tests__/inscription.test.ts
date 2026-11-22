import { creerCompte, surveillerSession, validerInscription } from '../auth';
import { employeCourant } from '../session';
import { getSupabase } from '../supabase';

jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));

const mockGet = getSupabase as jest.Mock;

function client(reponse: { data?: unknown; error?: unknown } | Error) {
  const signUp = jest.fn(async () => {
    if (reponse instanceof Error) throw reponse;
    return { data: { user: null, session: null }, error: null, ...reponse };
  });
  const signOut = jest.fn(async () => ({}));
  return { signUp, signOut, c: { auth: { signUp, signOut, onAuthStateChange: jest.fn() } } };
}

describe('validerInscription', () => {
  it('courriel valide et mot de passe de 8 caractères au moins', () => {
    expect(validerInscription('ana@exemple.ca', '12345678')).toBeNull();
    expect(validerInscription('pas-un-courriel', '12345678')).toBe('Entrez un courriel valide.');
    expect(validerInscription('', '12345678')).toBe('Entrez un courriel valide.');
    expect(validerInscription('ana@exemple.ca', '1234567')).toBe('Le mot de passe doit avoir 8 caractères au moins.');
  });
});

describe('creerCompte', () => {
  it('compte créé avec session : la session est fermée et le message dit quoi faire ensuite', async () => {
    const k = client({ data: { user: { identities: [{}] }, session: { access_token: 'x' } } });
    mockGet.mockReturnValue(k.c);
    const r = await creerCompte('ana@exemple.ca', '12345678');
    expect(r).toEqual({
      statut: 'cree',
      message: "Votre compte est créé. Un administrateur doit vous donner le rôle d'employé avant d'entrer dans l'espace du personnel.",
    });
    expect(k.signOut).toHaveBeenCalled();
    expect(employeCourant()).toBeNull();
  });

  it('prénom et nom passent dans options.data, courriel sans espaces', async () => {
    const k = client({ data: { user: { identities: [{}] }, session: null } });
    mockGet.mockReturnValue(k.c);
    await creerCompte('  ana@exemple.ca ', '12345678', ' Ana ', 'Roy');
    expect(k.signUp).toHaveBeenCalledWith({
      email: 'ana@exemple.ca',
      password: '12345678',
      options: { data: { prenom: 'Ana', nom: 'Roy' } },
    });
    await creerCompte('ana@exemple.ca', '12345678');
    expect(k.signUp).toHaveBeenLastCalledWith({ email: 'ana@exemple.ca', password: '12345678', options: { data: {} } });
  });

  it('confirmation par courriel demandée quand il n’y a pas de session', async () => {
    mockGet.mockReturnValue(client({ data: { user: { identities: [{}] }, session: null } }).c);
    const r = await creerCompte('ana@exemple.ca', '12345678');
    expect(r.statut).toBe('confirmation');
    expect(r.message).toMatch(/Confirmez votre courriel/);
  });

  it('courriel déjà utilisé : erreur explicite ou réponse sans identité', async () => {
    mockGet.mockReturnValue(client({ error: { code: 'user_already_exists', message: 'User already registered' } }).c);
    expect(await creerCompte('ana@exemple.ca', '12345678')).toEqual({
      statut: 'erreur',
      message: 'Ce courriel est déjà utilisé. Essayez de vous connecter.',
    });
    mockGet.mockReturnValue(client({ data: { user: { identities: [] }, session: null } }).c);
    expect((await creerCompte('ana@exemple.ca', '12345678')).message).toMatch(/déjà utilisé/);
  });

  it('mot de passe refusé par le serveur', async () => {
    mockGet.mockReturnValue(client({ error: { code: 'weak_password', message: 'Password should be at least 6' } }).c);
    expect((await creerCompte('ana@exemple.ca', '12345678')).message).toBe('Le mot de passe doit avoir 8 caractères au moins.');
  });

  it('pas de réseau et erreur inconnue', async () => {
    mockGet.mockReturnValue(client(Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' })).c);
    expect((await creerCompte('ana@exemple.ca', '12345678')).message).toBe(
      'Connexion impossible pour le moment. Vérifiez votre réseau.',
    );
    mockGet.mockReturnValue(client({ error: { message: 'boum' } }).c);
    expect((await creerCompte('ana@exemple.ca', '12345678')).message).toBe("Le compte n'a pas pu être créé. Réessayez.");
  });

  it('refus local avant tout appel réseau, et sans clés Supabase', async () => {
    const k = client({});
    mockGet.mockReturnValue(k.c);
    expect((await creerCompte('ana@exemple.ca', 'court')).statut).toBe('erreur');
    expect(k.signUp).not.toHaveBeenCalled();
    mockGet.mockReturnValue(null);
    expect((await creerCompte('ana@exemple.ca', '12345678')).statut).toBe('erreur');
  });

  it('pendant la création, la connexion automatique n’est pas reprise comme employé', async () => {
    jest.useFakeTimers();
    try {
      let rappel: ((e: string, s?: unknown) => void) | undefined;
      const k = client({ data: { user: { identities: [{}] }, session: { access_token: 'x' } } });
      (k.c.auth as unknown as { onAuthStateChange: unknown }).onAuthStateChange = (f: typeof rappel) => {
        rappel = f;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      };
      k.signUp.mockImplementation(async () => {
        rappel?.('SIGNED_IN', { user: { id: 'u1', email: 'ana@exemple.ca' } }); // événement émis pendant signUp
        return { data: { user: { identities: [{}] }, session: { access_token: 'x' } }, error: null };
      });
      mockGet.mockReturnValue(k.c);
      surveillerSession();
      await creerCompte('ana@exemple.ca', '12345678');
      await jest.advanceTimersByTimeAsync(20);
      expect(employeCourant()).toBeNull();
      expect(k.signOut).toHaveBeenCalledTimes(1); // seulement la fermeture faite par creerCompte
    } finally {
      jest.useRealTimers();
    }
  });
});
