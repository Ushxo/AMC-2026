import { compteDepuisLigne, libelleRoleCompte, listerComptes } from '../comptes-admin';
import { definirOrganisationCompte, lireMonOrganisation, lireOrganisations, MESSAGE_MIGRATION_ORGANISATIONS, ORGANISATIONS_EMBARQUEES, organisationDepuisLigne } from '../organisations';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) }) }));

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

describe('comptes du personnel (admin)', () => {
  it('lit une ligne et libelle le rôle', () => {
    const c = compteDepuisLigne({ id: 'u1', role: 'employe', poste: 'commis', prenom: 'Léa', nom: 'Roy', email: 'lea@ville.ca', organisation: 'Priorix', equipe: 'Équipe 1' });
    expect(c).toMatchObject({ id: 'u1', courriel: 'lea@ville.ca', nom: 'Léa Roy', organisation: 'Priorix', equipe: 'Équipe 1' });
    expect(libelleRoleCompte(c!)).toBe("Employé d'équipe");
    expect(libelleRoleCompte({ role: 'employe', poste: 'superviseur' })).toBe('Superviseur');
    expect(libelleRoleCompte({ role: 'admin', poste: null })).toBe('Administrateur');
    expect(compteDepuisLigne({ role: 'employe' })).toBeNull();
    expect(compteDepuisLigne(null)).toBeNull();
  });

  it('utilise la fonction complète quand elle existe', async () => {
    mockRpc.mockResolvedValue({ data: [{ user_id: 'u1', role: 'admin', courriel: 'a@v.ca' }], error: null });
    const l = await listerComptes();
    expect(l?.complete).toBe(true);
    expect(l?.comptes[0].courriel).toBe('a@v.ca');
  });

  it('retombe sur la table des profils (sans courriel) quand la fonction manque', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const ordre = jest.fn().mockResolvedValue({ data: [{ id: 'u2', role: 'employe', poste: 'superviseur', prenom: 'Zoé', nom: null }], error: null });
    mockFrom.mockReturnValue({ select: () => ({ in: () => ({ order: ordre }) }) });
    const l = await listerComptes();
    expect(l).toMatchObject({ complete: false });
    expect(l?.comptes[0]).toMatchObject({ courriel: null, nom: 'Zoé' });
  });

  it('rend null si rien ne peut être lu', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '500', message: 'panne' } });
    expect(await listerComptes()).toBeNull();
  });
});

describe('organisations', () => {
  it('lit une ligne en ignorant les couleurs invalides', () => {
    const o = organisationDepuisLigne({ id: 'o1', code: 'montreal', nom: 'Ville', nom_app: 'Égouts', slogan: null, logo: 'fleur', couleurs: { primary: '#b5121b', header: 'rouge', inconnu: '#000000' } });
    expect(o?.couleurs).toEqual({ primary: '#B5121B' });
    expect(organisationDepuisLigne({ nom: 'x' })).toBeNull();
  });
  it('repli : les deux marques embarquées sans base ou sans migration', async () => {
    mockFrom.mockReturnValue({ select: async () => ({ data: null, error: { message: 'column organisations.code does not exist' } }) });
    const r = await lireOrganisations();
    expect(r.enBase).toBe(false);
    expect(r.organisations.map((o) => o.code)).toEqual(['priorix', 'montreal']);
    expect(ORGANISATIONS_EMBARQUEES[1].couleurs.primary).toBe('#B5121B');
  });
  it('mon_organisation absente : null (la marque reste celle d’avant)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await lireMonOrganisation()).toBeNull();
  });
  it('changer l’organisation d’un compte : validation, succès, messages de la base', async () => {
    expect(await definirOrganisationCompte('x', 'montreal')).toContain('courriel');
    mockRpc.mockResolvedValueOnce({ error: null });
    expect(await definirOrganisationCompte('lea@ville.ca', 'montreal')).toBeNull();
    expect(mockRpc).toHaveBeenLastCalledWith('definir_organisation_compte', { p_courriel: 'lea@ville.ca', p_code: 'montreal' });
    mockRpc.mockResolvedValueOnce({ error: { message: 'Réservé aux administrateurs.' } });
    expect(await definirOrganisationCompte('lea@ville.ca', 'montreal')).toContain('administrateur');
    mockRpc.mockResolvedValueOnce({ error: { message: 'Aucun compte avec ce courriel.' } });
    expect(await definirOrganisationCompte('lea@ville.ca', 'montreal')).toBe('Aucun compte avec ce courriel.');
    mockRpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await definirOrganisationCompte('lea@ville.ca', 'montreal')).toBe(MESSAGE_MIGRATION_ORGANISATIONS);
  });
});
