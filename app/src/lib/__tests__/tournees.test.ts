import type { Tournee } from '../../types';
import { couleurEquipe } from '../../components/ville/style';
import {
  assemblerResultat,
  COMPARAISON_VIDE,
  nettoyerResultat,
  pointsTournee,
  resumerGain,
  type LigneDemande,
} from '../tournees';

const demande: LigneDemande = {
  id: 'd1',
  statut: 'terminee',
  message: null,
  termine_le: '2026-11-22T12:00:00Z',
  cree_le: '2026-11-22T11:59:00Z',
  comparaison: null,
  non_servis: [{ cle_endroit: 'grille:z', gravite: 'faible', raison: 'temps du quart dépassé' }],
  source_matrice: 'osrm_cache',
};

describe('assemblerResultat', () => {
  it('range les arrêts par tournée et par rang, avec les noms d’équipe', () => {
    const r = assemblerResultat(
      demande,
      [{ id: 't1', equipe_id: 'e1', distance_m: 10, duree_s: 20, debut_prevu: 'a', fin_prevue: 'b', geometrie: null }],
      [
        { id: 'a2', tournee_id: 't1', rang: 2, cle_endroit: 'grille:2', signalement_ids: ['s2'], latitude: 1, longitude: 2, arrivee_prevue: 'x', depart_prevu: 'y' },
        { id: 'a1', tournee_id: 't1', rang: 1, cle_endroit: 'grille:1', signalement_ids: ['s1'], latitude: 3, longitude: 4, arrivee_prevue: 'x', depart_prevu: 'y' },
        { id: 'ax', tournee_id: 'autre', rang: 1, cle_endroit: 'grille:x', signalement_ids: [], latitude: 0, longitude: 0, arrivee_prevue: 'x', depart_prevu: 'y' },
      ],
      [{ id: 'e1', nom: 'Équipe 1' }],
      [],
      COMPARAISON_VIDE,
    );
    expect(r.precalcule).toBe(false);
    expect(r.tournees[0].equipe_nom).toBe('Équipe 1');
    expect(r.tournees[0].arrets.map((a) => a.rang)).toEqual([1, 2]);
    expect(r.tournees[0].arrets[0].position).toEqual({ latitude: 3, longitude: 4 });
    expect(r.non_servis).toHaveLength(1);
    expect(r.comparaison).toEqual(COMPARAISON_VIDE);
  });

  it('équipe inconnue : nom par défaut', () => {
    const r = assemblerResultat(demande, [{ id: 't', equipe_id: 'inconnue', distance_m: 0, duree_s: 0, debut_prevu: 'a', fin_prevue: 'b', geometrie: null }], [], [], [], COMPARAISON_VIDE);
    expect(r.tournees[0].equipe_nom).toBe('Équipe');
  });
});

describe('pointsTournee', () => {
  const base = { equipe_id: 'e', equipe_nom: 'E', distance_m: 0, duree_s: 0, debut_prevu: '', fin_prevue: '' };
  const arrets = [
    { rang: 2, cle_endroit: 'b', signalement_ids: [], position: { latitude: 2, longitude: 2 }, arrivee_prevue: '', depart_prevu: '' },
    { rang: 1, cle_endroit: 'a', signalement_ids: [], position: { latitude: 1, longitude: 1 }, arrivee_prevue: '', depart_prevu: '' },
  ];
  it('géométrie OSRM : lng/lat devient lat/lng', () => {
    const t: Tournee = { ...base, arrets, geometrie: { type: 'LineString', coordinates: [[-73.5, 45.5], [-73.6, 45.6]] } };
    expect(pointsTournee(t)).toEqual([{ latitude: 45.5, longitude: -73.5 }, { latitude: 45.6, longitude: -73.6 }]);
  });
  it('sans géométrie : segments droits entre le garage et les arrêts dans l’ordre', () => {
    const t: Tournee = { ...base, arrets, geometrie: null };
    const g = { latitude: 0, longitude: 0 };
    expect(pointsTournee(t, g)).toEqual([g, { latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }, g]);
    expect(pointsTournee(t)).toHaveLength(2);
  });
});

describe('resumerGain', () => {
  it('à travail égal puis dans le quart', () => {
    const g = resumerGain({
      ordre_arrivee: { distance_m: 302356, duree_s: 142778, arrets_servis: 177, depassement_quart_s: 41978 },
      optimise: { distance_m: 77702, duree_s: 100046, arrets_servis: 177 },
      gain_distance_m: 224654,
      gain_duree_s: 42732,
      dans_le_quart: { ordre_arrivee: 121, optimise: 177, arrets_en_plus: 56 },
    });
    expect(g.egal).toEqual([
      { etiquette: 'Kilomètres en moins', valeur: '224,7 km' },
      { etiquette: 'Heures en moins', valeur: '11 h 52' },
      { etiquette: "Dépassement du quart de l'ordre d'arrivée", valeur: '11 h 40' },
    ]);
    expect(g.dansLeQuart).toBe('Dans le quart : 177 arrêts servis contre 121 (56 de plus).');
  });
});

describe('couleurEquipe', () => {
  it('une couleur par équipe, qui reboucle sans planter', () => {
    expect(couleurEquipe(0)).not.toBe(couleurEquipe(1));
    expect(couleurEquipe(8)).toBe(couleurEquipe(0));
    expect(couleurEquipe(-1)).toBe(couleurEquipe(7));
  });
});

describe('nettoyerResultat', () => {
  const base = {
    version: 1, demande_id: 'd', statut: 'terminee', message: null, calcule_le: 'x', duree_calcul_ms: 0,
    source_matrice: 'osrm_cache', precalcule: false,
  };
  const t = (extra = {}) => ({ equipe_id: 'e', equipe_nom: 'E', distance_m: 1, duree_s: 1, debut_prevu: 'a', fin_prevue: 'b', geometrie: null, arrets: [], ...extra });

  it('écarte les éléments vides et complète la comparaison', () => {
    const r = nettoyerResultat({
      ...base,
      incidents: [undefined, null, { id: 'i', type: 'autre', position: { latitude: 1, longitude: 2 }, rayon_m: 10, simule: true }, { id: 'j' }],
      tournees: [undefined, t({ arrets: [undefined, { rang: 1, position: { latitude: 1, longitude: 2 } }, { rang: 2 }] }), { equipe_id: 'sans arrets' }],
      non_servis: [undefined, { cle_endroit: 'c' }],
      comparaison: { gain_distance_m: 5 },
    } as never)!;
    expect(r.incidents.map((i) => i.id)).toEqual(['i']);
    expect(r.tournees).toHaveLength(1);
    expect(r.tournees[0].arrets.map((a) => a.rang)).toEqual([1]);
    expect(r.non_servis).toHaveLength(1);
    expect(r.comparaison.gain_distance_m).toBe(5);
    expect(r.comparaison.dans_le_quart).toEqual({ ordre_arrivee: 0, optimise: 0, arrets_en_plus: 0 });
    expect(() => resumerGain(r.comparaison)).not.toThrow();
  });

  it('résultat inutilisable : null', () => {
    expect(nettoyerResultat(null)).toBeNull();
    expect(nettoyerResultat(undefined)).toBeNull();
    expect(nettoyerResultat({ tournees: 'x' } as never)).toBeNull();
    expect(nettoyerResultat({} as never)).toBeNull();
  });

  it('listes absentes : tableaux vides', () => {
    const r = nettoyerResultat({ ...base, tournees: [t()] } as never)!;
    expect(r.incidents).toEqual([]);
    expect(r.non_servis).toEqual([]);
  });
});
