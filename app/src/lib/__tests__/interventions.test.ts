import type { Endroit, Signalement } from '../../types';
import { AUCUN_FILTRE, basculerExclue, clesDesInterventions, clesIncluses, filtreCalculable, toutCocher, toutDecocher, formaterDuree, interventionsAPlanifier } from '../interventions';
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

describe('liste du superviseur : filtre d’état et filtres combinés', () => {
  const mixtes = [
    endroit('n', 'moyenne', [sig('10', 'grille_bouchee', '2026-11-20T10:00:00Z', 'nouveau')]),
    endroit('p', 'elevee', [sig('11', 'eau_accumulee', '2026-11-20T11:00:00Z', 'pris_en_charge'), sig('12', 'eau_accumulee', '2026-11-20T12:00:00Z', 'regle')]),
    endroit('r', 'faible', [sig('13', 'affaissement', '2026-11-19T10:00:00Z', 'regle')]),
    endroit('x', 'faible', [sig('14', 'autre', '2026-11-18T10:00:00Z', 'rejete')]),
  ];
  const cles = (f: Partial<typeof AUCUN_FILTRE>) => clesDesInterventions(interventionsAPlanifier(mixtes, [], { ...AUCUN_FILTRE, ...f }));

  it('par défaut : à traiter (nouveau et pris en charge), comme avant', () => {
    expect(AUCUN_FILTRE.etat).toBe('a_traiter');
    expect(cles({})).toEqual(['p', 'n']);
  });
  it('un état précis, réglés, rejetés, tous', () => {
    expect(cles({ etat: 'nouveau' })).toEqual(['n']);
    expect(cles({ etat: 'pris_en_charge' })).toEqual(['p']);
    expect(cles({ etat: 'regle' })).toEqual(['p', 'r']);
    expect(cles({ etat: 'rejete' })).toEqual(['x']);
    expect(cles({ etat: 'tous' })).toEqual(['p', 'n', 'x', 'r']); // importance, puis le plus ancien d'abord
  });
  it('le nombre de signalements compte ceux qui correspondent aux filtres', () => {
    const p = (etat: 'a_traiter' | 'regle' | 'tous') => interventionsAPlanifier(mixtes, [], { ...AUCUN_FILTRE, etat }).find((i) => i.endroit.cle === 'p')?.nombre;
    expect([p('a_traiter'), p('regle'), p('tous')]).toEqual([1, 1, 2]);
  });
  it('filtres combinés : état, type de problème et importance', () => {
    expect(cles({ etat: 'regle', categorie: 'affaissement' })).toEqual(['r']);
    expect(cles({ etat: 'tous', gravite: 'faible' })).toEqual(['x', 'r']);
    expect(cles({ etat: 'a_traiter', categorie: 'eau_accumulee', gravite: 'elevee' })).toEqual(['p']);
    expect(cles({ etat: 'rejete', categorie: 'grille_bouchee' })).toEqual([]);
  });
  it('le calcul ne porte que sur des endroits à traiter', () => {
    expect(['a_traiter', 'nouveau', 'pris_en_charge'].every((e) => filtreCalculable(e as never))).toBe(true);
    expect(['regle', 'rejete', 'tous'].some((e) => filtreCalculable(e as never))).toBe(false);
  });
});

describe('durée du trajet', () => {
  it('se lit en minutes puis en heures', () => {
    expect(formaterDuree(18 * 60)).toBe('18 min');
    expect(formaterDuree(30)).toBe('1 min');
    expect(formaterDuree(65 * 60)).toBe('1 h 05');
  });
});

describe('cases à cocher du calcul : clés exclues', () => {
  const liste = interventionsAPlanifier(endroits, [], AUCUN_FILTRE); // d, b, c, a
  it('les clés incluses sont celles de la liste qui ne sont pas exclues, dans l’ordre', () => {
    expect(clesIncluses(liste, new Set())).toEqual(['d', 'b', 'c', 'a']);
    expect(clesIncluses(liste, new Set(['b', 'zzz']))).toEqual(['d', 'c', 'a']);
  });
  it('basculer ajoute ou retire une clé exclue sans modifier l’ensemble reçu', () => {
    const avant = new Set<string>();
    const apres = basculerExclue(avant, 'b');
    expect([...avant]).toEqual([]);
    expect([...apres]).toEqual(['b']);
    expect([...basculerExclue(apres, 'b')]).toEqual([]);
  });
  it('tout cocher et tout décocher ne touchent que la liste affichée', () => {
    const exclues = new Set(['hors-liste', 'b']);
    expect([...toutCocher(liste, exclues)]).toEqual(['hors-liste']);
    expect(clesIncluses(liste, toutDecocher(liste, new Set(['hors-liste'])))).toEqual([]);
    expect(toutDecocher(liste, new Set(['hors-liste'])).has('hors-liste')).toBe(true);
  });
  it('un endroit nouveau (jamais décoché) est inclus par défaut', () => {
    expect(clesIncluses([...liste], new Set(['a']))).toContain('d');
    expect(clesIncluses(liste, new Set(['a']))).not.toContain('a');
  });
});
