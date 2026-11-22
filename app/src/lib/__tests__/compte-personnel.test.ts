import { ErreurAuth } from '../auth';
import { creerComptePersonnel, erreurCreation, MESSAGE_COMPTE_DEJA, MESSAGE_REFUS_ADMIN, utilisateurDuFormulaire, validerPersonnel, type FormulairePersonnel } from '../compte-personnel';

const mockCreer = jest.fn();
const mockAssocier = jest.fn();
jest.mock('../auth', () => {
  const actual = jest.requireActual('../auth');
  return { ...actual, creerUtilisateur: (...a: unknown[]) => mockCreer(...a) };
});
jest.mock('../equipe-compte', () => ({ associerCompte: (...a: unknown[]) => mockAssocier(...a) }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const ok: FormulairePersonnel = { prenom: 'Léa', nom: 'Roy', courriel: ' lea@ville.ca ', motDePasse: 'provisoire1', role: 'equipe', equipeId: 'e1' };

beforeEach(() => {
  mockCreer.mockReset().mockResolvedValue({});
  mockAssocier.mockReset().mockResolvedValue(null);
});

describe('validation du formulaire', () => {
  it('relie chaque erreur à son champ', () => {
    const e = validerPersonnel({ prenom: '', nom: ' ', courriel: 'x', motDePasse: 'court', role: null, equipeId: null });
    expect(Object.keys(e).sort()).toEqual(['courriel', 'motDePasse', 'nom', 'prenom', 'role']);
    expect(validerPersonnel(ok)).toEqual({});
  });
});

describe('rôles envoyés au serveur', () => {
  it('équipe = employé commis, superviseur = employé superviseur, admin = admin', () => {
    expect(utilisateurDuFormulaire({ ...ok, role: 'equipe' })).toMatchObject({ role: 'employe', poste: 'commis', email: 'lea@ville.ca' });
    expect(utilisateurDuFormulaire({ ...ok, role: 'superviseur' })).toMatchObject({ role: 'employe', poste: 'superviseur' });
    const a = utilisateurDuFormulaire({ ...ok, role: 'admin' });
    expect(a).toMatchObject({ role: 'admin' });
    expect(a).not.toHaveProperty('poste');
  });
});

describe('création', () => {
  it('crée puis associe l\'équipe d\'un employé d\'équipe', async () => {
    const r = await creerComptePersonnel(ok);
    expect(r).toEqual({ ok: true, role: 'equipe', courriel: 'lea@ville.ca', avertissement: null });
    expect(mockAssocier).toHaveBeenCalledWith(' lea@ville.ca ', 'e1');
  });
  it('n\'associe pas d\'équipe à un superviseur ni sans choix', async () => {
    await creerComptePersonnel({ ...ok, role: 'superviseur' });
    await creerComptePersonnel({ ...ok, equipeId: null });
    expect(mockAssocier).not.toHaveBeenCalled();
  });
  it('dit si l\'équipe n\'a pas pu être associée, sans perdre le compte créé', async () => {
    mockAssocier.mockResolvedValue('Aucun compte');
    const r = await creerComptePersonnel(ok);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.avertissement).toContain('Aucun compte');
  });
  it('ne contacte pas le serveur si le formulaire est invalide', async () => {
    const r = await creerComptePersonnel({ ...ok, courriel: 'x' });
    expect(r).toMatchObject({ ok: false });
    expect(mockCreer).not.toHaveBeenCalled();
  });
  it('traduit les refus du serveur', async () => {
    mockCreer.mockRejectedValueOnce(new ErreurAuth('x', 403));
    expect(await creerComptePersonnel(ok)).toMatchObject({ ok: false, message: MESSAGE_REFUS_ADMIN });
    mockCreer.mockRejectedValueOnce(new ErreurAuth('User already registered', 422));
    expect(await creerComptePersonnel(ok)).toMatchObject({ ok: false, erreurs: { courriel: MESSAGE_COMPTE_DEJA } });
    mockCreer.mockRejectedValueOnce(new ErreurAuth('Password should be at least 8', 422));
    expect((await creerComptePersonnel(ok)) as { erreurs: Record<string, string> }).toHaveProperty('erreurs.motDePasse');
    mockCreer.mockRejectedValueOnce(new ErreurAuth('Serveur injoignable, réessaie.'));
    expect((await creerComptePersonnel(ok)) as { message: string }).toHaveProperty('message', expect.stringContaining('serveur'));
  });
  it('erreurCreation : cas inconnu = message général', () => {
    expect(erreurCreation(new Error('boum')).message).toContain('pas pu être créé');
  });
});
