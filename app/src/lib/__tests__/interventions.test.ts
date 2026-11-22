import type { Endroit, Signalement } from '../../types';
import { AUCUN_FILTRE, clesDesInterventions, interventionsAPlanifier } from '../interventions';
import type { Zone } from '../zones';

function sig(id: string, categorie: Signalement['categorie'], cree_le: string, etat: Signalement['etat'] = 'nouveau'): Signalement {
  return { id, categorie, cree_le, etat, latitude: 45.5, longitude: -73.57, gravite_choisie: 'moyenne' } as unknown as Signalement;
}
function endroit(cle: string, gravite: Endroit['gravite_affichee'], signalements: Signalement[]): Endroit {
  return {
    cle,
    position: { latitude: 45.5, longitude: -73.57 },
    nombre: signalements.length,
    gravite_choisie_max: gravite,
    gravite_par_nombre: gravite,
    gravite_affichee: gravite,
    etat_dominant: 'nouveau',
    signalements,
  };
}

const endroits = [
  endroit('a', 'faible', [sig('1', 'grille_bouchee', '2026-11-20T10:00:00Z')]),
  endroit('b', 'elevee', [sig('2', 'eau_accumulee', '2026-11-21T10:00:00Z')]),
  endroit('c', 'moyenne', [sig('3', 'affaissement', '2026-11-19T10:00:00Z')]),
  endroit('d', 'elevee', [sig('4', 'grille_endommagee', '2026-11-18T10:00:00Z')]),
  endroit('e', 'elevee', [sig('5', 'grille_bouchee', '2026-11-18T10:00:00Z', 'regle')]),
];

describe('interventions à planifier', () => {
  it('ne garde que les endroits ouverts, du plus important au moins important', () => {
    const l = interventionsAPlanifier(endroits, [], AUCUN_FILTRE);
    expect(clesDesInterventions(l)).toEqual(['d', 'b', 'c', 'a']);
  });
  it('filtre par importance et par type de problème', () => {
    expect(clesDesInterventions(interventionsAPlanifier(endroits, [], { ...AUCUN_FILTRE, gravite: 'elevee' }))).toEqual(['d', 'b']);
    expect(clesDesInterventions(interventionsAPlanifier(endroits, [], { ...AUCUN_FILTRE, categorie: 'affaissement' }))).toEqual(['c']);
  });
  it('filtre par secteur (zone)', () => {
    const zone = { id: 'z1', signalement_ids: ['1', '2'] } as unknown as Zone;
    expect(clesDesInterventions(interventionsAPlanifier(endroits, [zone], { ...AUCUN_FILTRE, zoneId: 'z1' }))).toEqual(['b', 'a']);
  });
});
