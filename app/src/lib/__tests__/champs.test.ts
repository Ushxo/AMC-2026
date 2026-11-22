import { erreursConnexion, erreursCourrielCompte, erreursEquipe, erreursInscription, erreursSignalement } from '../champs';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('erreurs par champ', () => {
  it('équipe : chaque champ dit quoi corriger', () => {
    expect(erreursEquipe({ nom: 'Équipe 1', debut: '07:00', fin: '14:00' })).toEqual({});
    expect(erreursEquipe({ nom: '  ', debut: '7h', fin: '25:00' })).toEqual({
      nom: "Entrez le nom de l'équipe.",
      debut: 'Écrivez l’heure ainsi : 07:00.',
      fin: 'Écrivez l’heure ainsi : 14:00.',
    });
    expect(erreursEquipe({ nom: 'a', debut: '14:00', fin: '07:00' }).fin).toMatch(/après son début/);
    expect(erreursEquipe({ nom: 'x'.repeat(61), debut: '07:00', fin: '14:00' }).nom).toMatch(/trop long/);
  });

  it('connexion et inscription', () => {
    expect(erreursConnexion({ courriel: '', motDePasse: '' })).toEqual({ courriel: 'Entrez votre courriel.', motDePasse: 'Entrez votre mot de passe.' });
    expect(erreursConnexion({ courriel: 'abc', motDePasse: 'x' }).courriel).toMatch(/pas valide/);
    expect(erreursInscription({ courriel: 'a@b.ca', motDePasse: 'court' }).motDePasse).toMatch(/8 caractères/);
    expect(erreursInscription({ courriel: 'a@b.ca', motDePasse: 'assez-long' })).toEqual({});
  });

  it('courriel du compte d’équipe', () => {
    expect(erreursCourrielCompte('')).toHaveProperty('courriel');
    expect(erreursCourrielCompte('nom@ville.ca')).toEqual({});
  });

  it('signalement : lieu, catégorie, gravité, commentaire trop long', () => {
    expect(erreursSignalement({ point: null, categorie: null, gravite: null, commentaire: '' })).toEqual({
      lieu: 'Choisissez le lieu : votre position, une adresse ou un point sur la carte.',
      categorie: 'Choisissez ce que vous signalez.',
      gravite: 'Choisissez la gravité du problème.',
    });
    expect(erreursSignalement({ point: {}, categorie: 'autre', gravite: 'faible', commentaire: 'x'.repeat(501) }).commentaire).toMatch(/trop long/);
    expect(erreursSignalement({ point: {}, categorie: 'autre', gravite: 'faible', commentaire: '' })).toEqual({});
  });
});
