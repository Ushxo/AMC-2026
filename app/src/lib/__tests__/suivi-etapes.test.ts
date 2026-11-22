import { etatsDesEtapes } from '../suivi-etapes';

describe('étapes du suivi', () => {
  it('reçu : Soumis en cours', () => expect(etatsDesEtapes('recu')).toEqual(['courant', 'avenir', 'avenir']));
  it('planifié et pris en charge : Soumis fait, Prise en charge en cours', () => {
    expect(etatsDesEtapes('planifie')).toEqual(['fait', 'courant', 'avenir']);
    expect(etatsDesEtapes('pris_en_charge')).toEqual(['fait', 'courant', 'avenir']);
  });
  it('réglé : tout est fait', () => expect(etatsDesEtapes('regle')).toEqual(['fait', 'fait', 'fait']));
});
