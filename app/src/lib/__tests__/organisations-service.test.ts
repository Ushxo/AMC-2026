import { codeDepuisNom, creerOrganisation, lireOrganisations, MESSAGE_ORGANISATION_MIGRATION_0010, MESSAGE_ORGANISATION_NOM, organisationDepuisLigne, ORGANISATIONS_EMBARQUEES } from '../organisations';
import { textesDe } from '@/marque/organisations-embarquees';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ getSupabase: () => ({ from: (...a: unknown[]) => mockFrom(...a) }) }));

const ligne = { id: 'o1', code: 'deneigement-nord', nom: 'Déneigement Nord', nom_app: 'Nord', slogan: null, logo: 'priorix', couleurs: {}, service: 'Déneigement', textes: { titreCarte: 'Carte des routes' } };

beforeEach(() => mockFrom.mockReset());

describe('organisations : service et textes', () => {
  it('lit le service et les textes, avec valeurs par défaut pour le reste', () => {
    const o = organisationDepuisLigne(ligne)!;
    expect(o.service).toBe('Déneigement');
    expect(textesDe(o)).toEqual({ titreCarte: 'Carte des routes', rechercheAdresse: 'Rechercher une adresse à Montréal' });
    expect(textesDe(organisationDepuisLigne({ ...ligne, textes: null, service: '' })!)).toEqual({ titreCarte: 'Carte des égouts', rechercheAdresse: 'Rechercher une adresse à Montréal' });
  });

  it('Montréal s’appelle « Ville de Montréal »', () => {
    expect(ORGANISATIONS_EMBARQUEES.find((o) => o.code === 'montreal')?.nom_app).toBe('Ville de Montréal');
  });

  it('sans la migration 0010, la lecture se rabat sur les colonnes d’avant', async () => {
    const select = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST204', message: "Could not find the 'service' column of 'organisations' in the schema cache" } })
      .mockResolvedValueOnce({ data: [{ ...ligne, service: undefined, textes: undefined }], error: null });
    mockFrom.mockReturnValue({ select });
    const r = await lireOrganisations();
    expect(r.enBase).toBe(true);
    expect(r.organisations[0].service).toBeNull();
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('code tiré du nom : sans accents, tirets, unique', () => {
    expect(codeDepuisNom('Déneigement Québec Nord', [])).toBe('deneigement-quebec-nord');
    expect(codeDepuisNom('Déneigement Québec Nord', ['deneigement-quebec-nord'])).toBe('deneigement-quebec-nord-2');
    expect(codeDepuisNom('???', [])).toBe('organisation');
  });
});

describe('création d’une organisation', () => {
  const nouvelle = organisationDepuisLigne({ ...ligne, id: undefined })!;

  it('refuse un nom vide sans appeler le serveur', async () => {
    expect(await creerOrganisation({ ...nouvelle, nom: ' ' })).toBe(MESSAGE_ORGANISATION_NOM);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('réussit pour un administrateur', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });
    expect(await creerOrganisation(nouvelle)).toBeNull();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ code: 'deneigement-nord', service: 'Déneigement' }));
  });

  it('sans droits : message clair', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: '42501', message: 'new row violates row-level security policy' } }) });
    expect(await creerOrganisation(nouvelle)).toBe('Seul un administrateur peut créer une organisation.');
  });

  it('migration 0010 pas lancée : message clair', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: 'PGRST204', message: "Could not find the 'service' column of 'organisations'" } }) });
    expect(await creerOrganisation(nouvelle)).toBe(MESSAGE_ORGANISATION_MIGRATION_0010);
  });

  it('code déjà pris : message clair', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } }) });
    expect(await creerOrganisation(nouvelle)).toMatch(/déjà ce code/);
  });
});
