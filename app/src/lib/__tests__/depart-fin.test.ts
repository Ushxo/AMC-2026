import type { Tournee } from '../../types';
import { resumeToutesEquipes } from '../durees';
import { assemblerResultat, COMPARAISON_VIDE, detailsTournee, estPartiel, libelleDepart, libelleFin, pointsTournee, positionTropAncienne } from '../tournees';

const garage = { latitude: 45.5, longitude: -73.6 };
const base: Tournee = {
  equipe_id: 'e1',
  equipe_nom: 'Équipe 1',
  distance_m: 1000,
  duree_s: 3600,
  debut_prevu: '2026-11-22T12:00:00Z',
  fin_prevue: '2026-11-22T13:00:00Z',
  geometrie: null,
  arrets: [
    { rang: 1, cle_endroit: 'a', signalement_ids: ['s'], position: { latitude: 45.51, longitude: -73.59 }, arrivee_prevue: '', depart_prevu: '' },
    { rang: 2, cle_endroit: 'b', signalement_ids: ['s'], position: { latitude: 45.52, longitude: -73.58 }, arrivee_prevue: '', depart_prevu: '' },
  ],
};

describe('départ et fin des tournées', () => {
  it('les champs absents se lisent comme garage et garage', () => {
    expect(detailsTournee(undefined)).toEqual({});
    expect(detailsTournee({})).toEqual({});
    expect(libelleDepart(base)).toBe('Départ : garage (simulé)');
    expect(libelleFin(base)).toBe('Fin : retour au garage');
    expect(pointsTournee(base, garage)).toHaveLength(4); // garage, 2 arrêts, garage
  });

  it('details : champs valides repris, le reste ignoré', () => {
    const d = detailsTournee({
      depart: 'position',
      depart_position: { latitude: 45.6, longitude: -73.7 },
      fin: 'endroit',
      fin_position: { latitude: 45.52, longitude: -73.58 },
      recalculee: true,
      faits_conserves: 3,
      conservee: 'oui',
      fin_inconnue: 1,
    });
    expect(d).toEqual({
      depart: 'position',
      depart_position: { latitude: 45.6, longitude: -73.7 },
      fin: 'endroit',
      fin_position: { latitude: 45.52, longitude: -73.58 },
      recalculee: true,
      faits_conserves: 3,
    });
    expect(detailsTournee({ depart: 'ailleurs', fin: 'nulle part', depart_position: { latitude: 'x' } })).toEqual({});
  });

  it('le tracé part de la position de l’équipe et ne revient pas au garage si la fin est libre ou à un endroit', () => {
    const position = { ...base, depart: 'position' as const, depart_position: { latitude: 45.505, longitude: -73.595 } };
    expect(pointsTournee(position, garage)[0]).toEqual({ latitude: 45.505, longitude: -73.595 });
    expect(pointsTournee(position, garage)).toHaveLength(4);
    const libre = { ...base, fin: 'libre' as const };
    expect(pointsTournee(libre, garage)).toHaveLength(3); // garage + 2 arrêts, sans retour
    expect(pointsTournee({ ...base, fin: 'endroit' as const }, garage)).toHaveLength(3);
    expect(libelleFin(libre)).toBe('Fin : au dernier arrêt');
    expect(libelleDepart(position)).toBe("Départ : position de l'équipe");
  });

  it('position trop ancienne : départ demandé à la position, départ reçu au garage', () => {
    expect(positionTropAncienne('position', base)).toBe(true);
    expect(positionTropAncienne('position', { depart: 'position' })).toBe(false);
    expect(positionTropAncienne('garage', base)).toBe(false);
    expect(positionTropAncienne(undefined, base)).toBe(false);
  });

  it('portée partielle : lue dans le résultat ou dans la comparaison ; absente = complète', () => {
    expect(estPartiel({ portee: 'partiel' } as never)).toBe(true);
    expect(estPartiel({ comparaison: { portee: 'partiel' } } as never)).toBe(true);
    expect(estPartiel({ comparaison: {} } as never)).toBe(false);
    expect(estPartiel({ portee: 'complet' } as never)).toBe(false);
  });

  it('totaux du service utilisés quand ils existent', () => {
    const avec = resumeToutesEquipes([base], { distance_m: 50000, duree_s: 7200, arrets_servis: 9 });
    expect(avec).toBe('Total toutes équipes : 2 h 00 · 50,0 km · 9 arrêts (durées cumulées)');
    expect(resumeToutesEquipes([base])).toContain('1 h 00 · 1,0 km · 2 arrêts');
  });
});

describe('lecture depuis la base', () => {
  const demande = { id: 'd1', statut: 'terminee', message: null, termine_le: null, cree_le: '2026-11-22T10:00:00Z', comparaison: null, non_servis: null, source_matrice: null };
  const ligne = { id: 't1', equipe_id: 'e1', distance_m: 1, duree_s: 2, debut_prevu: 'x', fin_prevue: 'y', geometrie: null };
  const arret = { id: 'a1', tournee_id: 't1', rang: 1, cle_endroit: 'k', signalement_ids: [], latitude: 45.5, longitude: -73.5, arrivee_prevue: 'x', depart_prevu: 'y', fait: true, fait_le: '2026-11-22T11:00:00Z' };

  it('sans colonne details : garage et garage, rien ne casse ; avec details : repris ; fait_le gardé', () => {
    const sans = assemblerResultat(demande, [ligne], [arret], [{ id: 'e1', nom: 'É1' }], [], COMPARAISON_VIDE);
    expect(sans.tournees[0].depart).toBeUndefined();
    expect(sans.tournees[0].arrets[0].fait_le).toBe('2026-11-22T11:00:00Z');
    expect(sans.portee).toBeUndefined();
    const avec = assemblerResultat(
      { ...demande, comparaison: { ...COMPARAISON_VIDE, portee: 'partiel' } },
      [{ ...ligne, details: { depart: 'position', recalculee: true, faits_conserves: 1 } }],
      [arret],
      [{ id: 'e1', nom: 'É1' }],
      [],
      COMPARAISON_VIDE,
    );
    expect(avec.tournees[0].depart).toBe('position');
    expect(avec.tournees[0].faits_conserves).toBe(1);
    expect(avec.portee).toBe('partiel');
  });
});
