import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  changerMotDePasse,
  connecter,
  creerUtilisateur,
  envoyerCodeReinitialisation,
  ErreurAuth,
  inscrireCitoyen,
  monProfil,
  verifierCodeReinitialisation,
} from '../auth';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
    },
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const sb = supabase as unknown as {
  auth: Record<string, jest.Mock>;
  rpc: jest.Mock;
  functions: { invoke: jest.Mock };
};

const PROFIL = {
  id: 'u1',
  role: 'citoyen',
  poste: null,
  prenom: 'Léa',
  nom: 'Roy',
  created_at: '2026-11-21T00:00:00Z',
};

beforeEach(() => {
  jest.resetAllMocks();
  sb.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
  sb.rpc.mockResolvedValue({ data: PROFIL, error: null });
});

describe('connecter', () => {
  it('renvoie le profil après un login réussi', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await expect(connecter(' lea@example.com ', 'mdp')).resolves.toEqual(PROFIL);
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'lea@example.com',
      password: 'mdp',
    });
  });

  it('traduit un mauvais mot de passe en français', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    });
    await expect(connecter('a@b.com', 'x')).rejects.toMatchObject({
      name: 'ErreurAuth',
      message: 'Email ou mot de passe incorrect.',
      code: 'invalid_credentials',
    });
  });
});

describe('inscrireCitoyen', () => {
  it('envoie prénom et nom dans les métadonnées', async () => {
    sb.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await inscrireCitoyen({ email: 'a@b.com', motDePasse: 'mdp', prenom: 'Léa', nom: 'Roy' });
    expect(sb.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'mdp',
      options: { data: { prenom: 'Léa', nom: 'Roy' } },
    });
  });

  it("signale l'email à confirmer quand il n'y a pas de session", async () => {
    sb.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(inscrireCitoyen({ email: 'a@b.com', motDePasse: 'mdp' })).rejects.toMatchObject({
      code: 'email_not_confirmed',
    });
  });
});

describe('monProfil', () => {
  it('renvoie null sans session', async () => {
    sb.auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(monProfil()).resolves.toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('renvoie null quand la ligne de profil est vide', async () => {
    sb.rpc.mockResolvedValue({ data: { id: null }, error: null });
    await expect(monProfil()).resolves.toBeNull();
  });
});

describe('creerUtilisateur', () => {
  it('envoie password (et non motDePasse) à la fonction', async () => {
    sb.functions.invoke.mockResolvedValue({ data: { ...PROFIL, email: 'e@b.com' }, error: null });
    await creerUtilisateur({ role: 'employe', poste: 'commis', email: 'e@b.com', motDePasse: 'secret12' });
    expect(sb.functions.invoke).toHaveBeenCalledWith('creer-utilisateur', {
      body: { role: 'employe', poste: 'commis', email: 'e@b.com', password: 'secret12' },
    });
  });

  it("remonte le message d'erreur et le statut de la fonction", async () => {
    const reponse = new Response(JSON.stringify({ erreur: 'Réservé aux administrateurs' }), {
      status: 403,
    });
    sb.functions.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(reponse) });
    const promesse = creerUtilisateur({ role: 'admin', email: 'x@b.com', motDePasse: 'secret12' });
    await expect(promesse).rejects.toBeInstanceOf(ErreurAuth);
    await expect(promesse).rejects.toMatchObject({
      message: 'Réservé aux administrateurs',
      code: 403,
    });
  });
});

describe('mot de passe oublié', () => {
  it("envoie le code à l'email nettoyé", async () => {
    sb.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await envoyerCodeReinitialisation(' lea@example.com ');
    expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('lea@example.com');
  });

  it('vérifie le code en type recovery, espaces retirés, et renvoie le profil', async () => {
    sb.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    await expect(verifierCodeReinitialisation('lea@example.com', '123 456')).resolves.toEqual(PROFIL);
    expect(sb.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'lea@example.com',
      token: '123456',
      type: 'recovery',
    });
  });

  it('traduit un code expiré', async () => {
    sb.auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' },
    });
    await expect(verifierCodeReinitialisation('a@b.com', '000000')).rejects.toMatchObject({
      message: 'Code invalide ou expiré.',
    });
  });

  it('change le mot de passe et refuse le même que l’ancien', async () => {
    sb.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
    await changerMotDePasse('Nouveau123');
    expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'Nouveau123' });

    sb.auth.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: 'same_password', status: 422, message: 'same password' },
    });
    await expect(changerMotDePasse('Nouveau123')).rejects.toMatchObject({ code: 'same_password' });
  });
});
