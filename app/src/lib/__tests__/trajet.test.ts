import type { Arret, Tournee } from '../../types';
import { arretsTries, idArret, prochainArret, regionAutour, trouverTournee } from '../trajet';

jest.mock('../supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const region = { latitude: 45.5, longitude: -73.56, latitudeDelta: 0.03, longitudeDelta: 0.04 };

function arret(rang: number, extra: Partial<Arret> = {}): Arret {
  return {
    rang, cle_endroit: `grille:${rang}`, signalement_ids: [`s${rang}`],
    position: { latitude: 45.5 + rang / 1000, longitude: -73.56 },
    arrivee_prevue: '2026-11-22T12:00:00+00:00', depart_prevu: '2026-11-22T12:05:00+00:00', ...extra,
  };
}

const tournee: Tournee = {
  equipe_id: 'e1', equipe_nom: 'Équipe 1', distance_m: 1, duree_s: 1,
  debut_prevu: '', fin_prevue: '', geometrie: null, arrets: [arret(3), arret(1), arret(2)],
};

describe('lib/trajet', () => {
  it('identifie un arrêt par son id, sinon par sa clé d’endroit', () => {
    expect(idArret(arret(1, { id: 'a1' }))).toBe('a1');
    expect(idArret(arret(1))).toBe('grille:1');
  });

  it('trie par rang et trouve le prochain arrêt non fait', () => {
    expect(arretsTries(tournee).map((a) => a.rang)).toEqual([1, 2, 3]);
    expect(prochainArret(tournee, () => false)?.rang).toBe(1);
    expect(prochainArret(tournee, (a) => a.rang < 3)?.rang).toBe(3);
    expect(prochainArret(tournee, () => true)).toBeNull();
  });

  it('trouve la tournée d’une équipe', () => {
    const resultat = { tournees: [tournee] } as never;
    expect(trouverTournee(resultat, 'e1')).toBe(tournee);
    expect(trouverTournee(resultat, 'autre')).toBeNull();
    expect(trouverTournee(null, 'e1')).toBeNull();
  });

  it('centre la carte sur les points, avec une marge', () => {
    const r = regionAutour(
      [{ latitude: 45.5, longitude: -73.6 }, { latitude: 45.52, longitude: -73.5 }],
      region,
    );
    expect(r.latitude).toBeCloseTo(45.51);
    expect(r.longitudeDelta).toBeGreaterThan(0.1);
    expect(regionAutour([], region)).toBe(region);
  });
});


describe('résultat d’un arrêt : écriture, statuts, avancement', () => {
  const { ecrireResultatArret, libelleAvancement, statutArret, commentaireArret, noterFaitLocal, noterNonFaitLocal, lireEtatTrajet, reinitialiserTrajet, tourneeTerminee } = jest.requireActual('../trajet') as typeof import('../trajet');
  const { getSupabase } = jest.requireMock('../supabase') as { getSupabase: jest.Mock };

  beforeEach(() => reinitialiserTrajet());

  function client(reponses: { error: unknown; data?: unknown }[]) {
    const update = jest.fn((_champs: Record<string, unknown>) => ({ eq: () => ({ select: async () => reponses.shift() ?? { error: null, data: [{ id: 'a' }] } }) }));
    getSupabase.mockReturnValue({ from: () => ({ update }) });
    return update;
  }

  it('Oui : écrit fait, l’heure et le commentaire ; Non : non fait, fait faux, commentaire', async () => {
    const update = client([{ error: null, data: [{ id: 'a' }] }, { error: null, data: [{ id: 'a' }] }]);
    expect(await ecrireResultatArret('a', { fait: true, commentaire: ' Un mot ' })).toBe('ok');
    expect(update.mock.calls[0][0]).toMatchObject({ fait: true, non_fait: false, commentaire: 'Un mot' });
    expect(await ecrireResultatArret('a', { fait: false, commentaire: 'Grille brisée' })).toBe('ok');
    expect(update.mock.calls[1][0]).toMatchObject({ fait: false, fait_le: null, non_fait: true, commentaire: 'Grille brisée' });
  });

  it('migration 0012 absente : Oui retombe sur l’ancien écrit, Non rend « migration »', async () => {
    const refus = { error: { code: 'PGRST204', message: "Could not find the 'non_fait' column" } };
    const update = client([refus, { error: null, data: [{ id: 'a' }] }]);
    expect(await ecrireResultatArret('a', { fait: true, commentaire: 'x' })).toBe('ok_sans_commentaire');
    expect(Object.keys(update.mock.calls[1][0]).sort()).toEqual(['fait', 'fait_le']);
    client([refus]);
    expect(await ecrireResultatArret('a', { fait: false, commentaire: 'x' })).toBe('migration');
  });

  it('autre erreur ou aucune ligne : échec', async () => {
    client([{ error: { code: '500', message: 'panne' } }]);
    expect(await ecrireResultatArret('a', { fait: true, commentaire: '' })).toBe('echec');
    client([{ error: null, data: [] }]);
    expect(await ecrireResultatArret('a', { fait: true, commentaire: '' })).toBe('echec');
  });

  it('le choix noté ici passe avant la base, et se corrige dans les deux sens', () => {
    const a = arret(1, { id: 'A', fait: true });
    expect(statutArret(a, lireEtatTrajet())).toBe('fait');
    noterNonFaitLocal('A', 'Accès impossible');
    expect(statutArret(a, lireEtatTrajet())).toBe('non_fait');
    expect(commentaireArret(a, lireEtatTrajet())).toBe('Accès impossible');
    noterFaitLocal('A', 'Réparé quand même');
    expect(statutArret(a, lireEtatTrajet())).toBe('fait');
    expect(commentaireArret(a, lireEtatTrajet())).toBe('Réparé quand même');
    expect(statutArret(arret(2, { non_fait: true }), lireEtatTrajet())).toBe('non_fait');
    expect(statutArret(arret(3), lireEtatTrajet())).toBeNull();
  });

  it('avancement : « 3 arrêts traités sur 7, dont 1 non fait » ; la tournée finit quand tout est traité', () => {
    expect(libelleAvancement(3, 7, 1)).toBe('3 arrêts traités sur 7, dont 1 non fait');
    expect(libelleAvancement(1, 7, 0)).toBe('1 arrêt traité sur 7');
    expect(libelleAvancement(4, 7, 2)).toBe('4 arrêts traités sur 7, dont 2 non faits');
    const arrets = [arret(1), arret(2)];
    expect(tourneeTerminee(arrets, (a) => a.rang === 1, () => false)).toBe(false);
    expect(tourneeTerminee(arrets, () => true, () => false)).toBe(true);
  });
});
