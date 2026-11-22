import { colonneAbsente, equipeDepuisLigne, ligneDepuisEquipe, MESSAGE_ADRESSES_PAS_ENCORE, modifierEquipe, sansColonnes0007 } from '../equipes';
import { getSupabase } from '../supabase';
import { cibleFinTournee, detailsTournee, libelleArriveePlan, libelleDepartPlan } from '../tournees';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../source', () => ({ avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p) }));

const ligne = { id: 'e1', nom: 'É1', membres: [], vehicule: null, garage_latitude: 45.5, garage_longitude: -73.57, debut_quart: '07:00:00', fin_quart: '14:00:00', active: true, exemple_demo: false };

describe('adresses de départ et d’arrivée des équipes', () => {
  it('lecture : colonnes absentes = pas d’adresse ; présentes = reprises', () => {
    const sans = equipeDepuisLigne(ligne);
    expect(sans.garage_adresse).toBeUndefined();
    expect(sans.arrivee).toBeUndefined();
    const avec = equipeDepuisLigne({ ...ligne, garage_adresse: '800 rue X', arrivee_latitude: 45.51, arrivee_longitude: -73.56, arrivee_adresse: '12 rue Y', arrivee_nom: 'Dépôt' });
    expect(avec.garage_adresse).toBe('800 rue X');
    expect(avec.arrivee).toEqual({ latitude: 45.51, longitude: -73.56 });
    expect(avec.arrivee_adresse).toBe('12 rue Y');
    expect(equipeDepuisLigne({ ...ligne, arrivee_latitude: 45.5, arrivee_longitude: null }).arrivee).toBeUndefined();
  });

  it('écriture : « même adresse que le départ » efface les deux coordonnées ensemble', () => {
    expect(ligneDepuisEquipe({ arrivee: null, arrivee_adresse: null })).toEqual({ arrivee_latitude: null, arrivee_longitude: null, arrivee_adresse: null });
    expect(ligneDepuisEquipe({ arrivee: { latitude: 45.5, longitude: -73.5 } })).toEqual({ arrivee_latitude: 45.5, arrivee_longitude: -73.5 });
    expect(sansColonnes0007({ nom: 'x', garage_adresse: 'a', arrivee_latitude: 1 })).toEqual({ nom: 'x' });
  });

  it('colonne absente (migration 0007 pas lancée) reconnue', () => {
    expect(colonneAbsente({ code: 'PGRST204', message: 'x' })).toBe(true);
    expect(colonneAbsente({ code: '42703' })).toBe(true);
    expect(colonneAbsente({ message: 'Could not find the column in the schema cache' })).toBe(true);
    expect(colonneAbsente({ code: '23505', message: 'doublon' })).toBe(false);
    expect(colonneAbsente(null)).toBe(false);
  });

  it('sans la 0007 : le reste est enregistré, l’écran dit « bientôt disponible », jamais d’erreur brute', async () => {
    const appels: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        update: (l: Record<string, unknown>) => ({
          eq: async () => {
            appels.push(l);
            return 'garage_adresse' in l ? { error: { code: 'PGRST204', message: 'colonne' } } : { error: null };
          },
        }),
      }),
    };
    (getSupabase as jest.Mock).mockReturnValue(client);
    const r = await modifierEquipe('e1', { nom: 'Équipe 1', garage_adresse: '800 rue X' });
    expect(r).toBe(MESSAGE_ADRESSES_PAS_ENCORE);
    expect(appels).toHaveLength(2);
    expect(appels[1]).toEqual({ nom: 'Équipe 1' });
  });

  it('une autre erreur reste le message d’échec habituel', async () => {
    (getSupabase as jest.Mock).mockReturnValue({ from: () => ({ update: () => ({ eq: async () => ({ error: { code: '23505', message: 'doublon' } }) }) }) });
    const r = await modifierEquipe('e1', { nom: 'Équipe 1', garage_adresse: 'x' });
    expect(r).not.toBe(MESSAGE_ADRESSES_PAS_ENCORE);
    expect(r).toMatch(/équipe/i);
  });
});

describe('libellés de départ et d’arrivée du plan', () => {
  it('départ : garage avec adresse, garage simulé, position avec heure', () => {
    expect(libelleDepartPlan({}, { garage_adresse: '800 rue X' })).toBe('Départ : garage, 800 rue X');
    expect(libelleDepartPlan({}, null)).toBe('Départ : garage (simulé)');
    expect(libelleDepartPlan({}, { garage_adresse: '800 rue X' }, null, 'Départ prévu')).toBe('Départ prévu : garage, 800 rue X');
    expect(libelleDepartPlan({ depart: 'position' }, null, '2026-11-23T03:14:00Z')).toMatch(/^Départ : position de l'équipe \(/);
  });
  it('arrivée : garage, adresse d’arrivée, dernier arrêt, endroit choisi', () => {
    expect(libelleArriveePlan({}, { garage_adresse: '800 rue X' })).toBe('Arrivée : garage, 800 rue X');
    expect(libelleArriveePlan({}, { arrivee: { latitude: 45.5, longitude: -73.5 }, arrivee_adresse: '12 rue Y' })).toBe('Arrivée : 12 rue Y');
    expect(libelleArriveePlan({ fin: 'libre' }, null)).toBe('Arrivée : au dernier arrêt');
    expect(libelleArriveePlan({ fin: 'endroit' }, null)).toBe("Arrivée : à l'endroit choisi");
  });
  it('dernière destination : l’adresse d’arrivée de l’équipe quand elle diffère du garage', () => {
    const garage = { latitude: 45.5, longitude: -73.6 };
    const arrivee = { latitude: 45.53, longitude: -73.55 };
    const t = { fin: 'garage' as const, arrets: [] };
    expect(cibleFinTournee(t, garage, arrivee)).toEqual({ position: arrivee, nom: 'fin' });
    expect(cibleFinTournee(t, garage, null)).toEqual({ position: garage, nom: 'garage' });
    expect(cibleFinTournee({ ...t, fin_position: garage }, garage, arrivee)).toEqual({ position: garage, nom: 'garage' }); // le service l'emporte
  });
});

describe('fin = arrivee et fin_nom', () => {
  it('detailsTournee accepte « arrivee » (sinon il serait lu comme garage) et le nom', () => {
    expect(detailsTournee({ fin: 'arrivee', fin_nom: 'Dépôt Est', fin_position: { latitude: 45.5, longitude: -73.5 } })).toEqual({
      fin: 'arrivee',
      fin_nom: 'Dépôt Est',
      fin_position: { latitude: 45.5, longitude: -73.5 },
    });
    expect(detailsTournee({ fin: 'nimporte' })).toEqual({});
  });
  it('libellés et dernière destination : l’adresse d’arrivée du service', () => {
    expect(libelleArriveePlan({ fin: 'arrivee', fin_nom: 'Dépôt Est' }, null)).toBe('Arrivée : Dépôt Est');
    expect(libelleArriveePlan({ fin: 'arrivee' }, { arrivee_adresse: '12 rue Y' })).toBe('Arrivée : 12 rue Y');
    const garage = { latitude: 45.5, longitude: -73.6 };
    const fin = { latitude: 45.53, longitude: -73.55 };
    expect(cibleFinTournee({ fin: 'arrivee', fin_position: fin, arrets: [] }, garage)).toEqual({ position: fin, nom: 'fin' });
  });
});
