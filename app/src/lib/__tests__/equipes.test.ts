import { equipeDepuisLigne, hhmm, incidentDepuisLigne, ligneDepuisEquipe, validerEquipe } from '../equipes';

jest.mock('../source', () => ({ avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p) }));
jest.mock('../supabase', () => ({ getSupabase: jest.fn(() => null) }));

describe('équipes', () => {
  it('hhmm garde heures et minutes', () => {
    expect(hhmm('08:00:00')).toBe('08:00');
    expect(hhmm('16:30')).toBe('16:30');
  });

  it('ligne de la base vers Equipe et retour', () => {
    const e = equipeDepuisLigne({
      id: 'e1', nom: 'Équipe A', membres: null, vehicule: null, garage_latitude: '45.51', garage_longitude: -73.57,
      debut_quart: '08:00:00', fin_quart: '16:00:00', active: true, exemple_demo: false,
    });
    expect(e).toEqual({
      id: 'e1', nom: 'Équipe A', membres: [], vehicule: null, garage: { latitude: 45.51, longitude: -73.57 },
      debut_quart: '08:00', fin_quart: '16:00', active: true, exemple_demo: false,
    });
    expect(ligneDepuisEquipe({ nom: ' Équipe B ', garage: { latitude: 45.5, longitude: -73.6 }, debut_quart: '07:00' })).toEqual({
      nom: 'Équipe B', garage_latitude: 45.5, garage_longitude: -73.6, debut_quart: '07:00',
    });
    expect(ligneDepuisEquipe({})).toEqual({});
  });

  it('validation : nom, garage dans Montréal, quart', () => {
    const ok = { nom: 'A', membres: [], vehicule: null, garage: { latitude: 45.5, longitude: -73.57 }, debut_quart: '08:00', fin_quart: '16:00' };
    expect(validerEquipe(ok, true)).toBeNull();
    expect(validerEquipe({ ...ok, nom: '   ' }, true)).toMatch(/nom/);
    expect(validerEquipe({ ...ok, nom: 'x'.repeat(61) }, true)).toMatch(/60/);
    expect(validerEquipe({ ...ok, garage: { latitude: 46.8, longitude: -71.2 } }, true)).toBe(
      'Ce point est hors de Montréal. Déplacez-le sur la carte.',
    );
    expect(validerEquipe({ ...ok, fin_quart: '07:00' }, true)).toMatch(/quart/);
    expect(validerEquipe({ active: false }, false)).toBeNull();
    expect(validerEquipe({ nom: '' }, false)).toMatch(/nom/);
  });

  it('incident : toujours simulé', () => {
    const i = incidentDepuisLigne({ id: 'i', type: 'rue_fermee', latitude: '45.5', longitude: '-73.5', rayon_m: 100, description: null, actif: true, cree_le: 'x' });
    expect(i.simule).toBe(true);
    expect(i.position).toEqual({ latitude: 45.5, longitude: -73.5 });
  });
});
