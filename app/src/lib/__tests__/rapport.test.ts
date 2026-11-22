import type { Arret, Tournee } from '../../types';
import { ecrireEvaluation, envoyerRapport, evaluationDe, lireEtatRapport, rapportEnvoyeLe, reinitialiserRapport } from '../rapport';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../supabase', () => ({ getSupabase: () => null }));

const arret = (rang: number, extra: Partial<Arret> = {}): Arret => ({
  rang,
  cle_endroit: `e${rang}`,
  signalement_ids: [`s${rang}`],
  position: { latitude: 45.5, longitude: -73.6 },
  arrivee_prevue: '2026-11-22T13:00:00Z',
  depart_prevu: '2026-11-22T13:10:00Z',
  ...extra,
});

const tournee: Tournee = {
  equipe_id: 'eq1',
  equipe_nom: 'Équipe 1',
  distance_m: 1000,
  duree_s: 600,
  debut_prevu: '2026-11-22T13:00:00Z',
  fin_prevue: '2026-11-22T14:00:00Z',
  geometrie: null,
  arrets: [arret(1)],
};

beforeEach(() => reinitialiserRapport());

describe('évaluation d’un arrêt', () => {
  it('aucune évaluation tant que l’arrêt n’est ni fait ni évalué', () => {
    expect(evaluationDe(arret(1), new Map())).toBeNull();
  });

  it('un arrêt fait sans évaluation compte comme réparé', () => {
    expect(evaluationDe(arret(1, { fait: true, fait_le: '2026-11-22T13:05:00Z' }), new Map())?.regle).toBe(true);
  });

  it('lit l’évaluation « pas réglé » de la base avec son commentaire', () => {
    const e = evaluationDe(arret(1, { regle: false, commentaire: 'Grille à remplacer', evalue_le: '2026-11-22T13:05:00Z' }), new Map());
    expect(e).toEqual({ regle: false, commentaire: 'Grille à remplacer', evalue_le: '2026-11-22T13:05:00Z' });
  });

  it('l’évaluation notée sur le téléphone passe avant la base ; pas de commentaire si réparé', async () => {
    const a = arret(1, { regle: false, commentaire: 'ancien', evalue_le: '2026-11-22T13:00:00Z' });
    expect(await ecrireEvaluation(a, true, 'ignoré')).toBe(true);
    const e = evaluationDe(a, lireEtatRapport().evaluations);
    expect(e?.regle).toBe(true);
    expect(e?.commentaire).toBeNull();
  });

  it('« pas réglé » garde le commentaire, sans espaces autour', async () => {
    const a = arret(2);
    await ecrireEvaluation(a, false, '  Grille à remplacer  ');
    expect(evaluationDe(a, lireEtatRapport().evaluations)).toMatchObject({ regle: false, commentaire: 'Grille à remplacer' });
  });
});

describe('envoi du rapport', () => {
  it('hors base : le rapport est noté envoyé sur ce téléphone', async () => {
    expect(rapportEnvoyeLe(tournee, new Map())).toBeNull();
    expect(await envoyerRapport(tournee)).toBe(true);
    expect(rapportEnvoyeLe(tournee, lireEtatRapport().envoyes)).not.toBeNull();
  });

  it('lit le moment d’envoi gardé par la base', () => {
    expect(rapportEnvoyeLe({ ...tournee, rapport_envoye_le: '2026-11-22T15:00:00Z' }, new Map())).toBe('2026-11-22T15:00:00Z');
  });
});
