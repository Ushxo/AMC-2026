import { cleEndroit, graviteMax, graviteParNombre, regrouper, trierEndroits } from '../gravite';
import { sig } from '../test-utils/fabrique';

describe('gravite', () => {
  it('graviteParNombre aux seuils', () => {
    expect(graviteParNombre(19)).toBe('faible');
    expect(graviteParNombre(20)).toBe('moyenne');
    expect(graviteParNombre(49)).toBe('moyenne');
    expect(graviteParNombre(50)).toBe('elevee');
  });

  it('graviteMax', () => {
    expect(graviteMax('faible', 'elevee')).toBe('elevee');
    expect(graviteMax('moyenne', 'faible')).toBe('moyenne');
  });

  it('cleEndroit : grille, sinon case de 0,0005°', () => {
    expect(cleEndroit(sig({ grille_id: 'g1' }))).toBe('grille:g1');
    const a = cleEndroit(sig({ latitude: 45.50501, longitude: -73.56702 }));
    const b = cleEndroit(sig({ latitude: 45.50512, longitude: -73.56711 }));
    const c = cleEndroit(sig({ latitude: 45.51, longitude: -73.56702 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('case:')).toBe(true);
  });

  it('regrouper ne compte que les signalements ouverts', () => {
    const liste = Array.from({ length: 20 }, () => sig({ grille_id: 'g1' }));
    liste.push(sig({ grille_id: 'g1', etat: 'rejete' }), sig({ grille_id: 'g1', etat: 'regle' }));
    const [e] = regrouper(liste);
    expect(e.nombre).toBe(20);
    expect(e.gravite_par_nombre).toBe('moyenne');
    expect(e.signalements).toHaveLength(22);
  });

  it('25 signalements dont 10 réglés : nombre 15, gravité par nombre faible', () => {
    const liste = [
      ...Array.from({ length: 15 }, () => sig({ grille_id: 'g' })),
      ...Array.from({ length: 10 }, () => sig({ grille_id: 'g', etat: 'regle' })),
    ];
    const [e] = regrouper(liste);
    expect(e.nombre).toBe(15);
    expect(e.gravite_par_nombre).toBe('faible');
  });

  it('20 réglés : nombre 0, la liste garde les signalements', () => {
    const [e] = regrouper(Array.from({ length: 20 }, () => sig({ grille_id: 'g', etat: 'regle' })));
    expect(e.nombre).toBe(0);
    expect(e.gravite_affichee).toBe('faible');
    expect(e.etat_dominant).toBe('regle');
    expect(e.signalements).toHaveLength(20);
  });

  it('avec et sans grille_id : endroits séparés', () => {
    const e = regrouper([
      sig({ grille_id: 'g', latitude: 45.505, longitude: -73.567 }),
      sig({ grille_id: null, latitude: 45.505, longitude: -73.567 }),
      sig({ grille_id: null, latitude: 45.505, longitude: -73.567 }),
    ]);
    expect(e).toHaveLength(2);
    expect(e.map((x) => x.nombre).sort()).toEqual([1, 2]);
  });

  it('regrouper : gravité choisie plus haute que celle du nombre', () => {
    const [e] = regrouper([sig({ grille_id: 'g', gravite: 'elevee' })]);
    expect(e.gravite_affichee).toBe('elevee');
  });

  it("etat_dominant : le moins avancé des ouverts, sinon regle, sinon rejete", () => {
    expect(
      regrouper([
        sig({ grille_id: 'g', etat: 'pris_en_charge' }),
        sig({ grille_id: 'g', etat: 'nouveau' }),
        sig({ grille_id: 'g', etat: 'regle' }),
      ])[0].etat_dominant,
    ).toBe('nouveau');
    expect(
      regrouper([sig({ grille_id: 'g', etat: 'regle' }), sig({ grille_id: 'g', etat: 'rejete' })])[0].etat_dominant,
    ).toBe('regle');
    const seul = regrouper([sig({ grille_id: 'g', etat: 'rejete' })])[0];
    expect(seul.etat_dominant).toBe('rejete');
    expect(seul.nombre).toBe(0);
  });

  it('trierEndroits : gravité puis date décroissantes', () => {
    const e = regrouper([
      sig({ grille_id: 'a', gravite: 'faible', cree_le: '2026-11-20T10:00:00Z' }),
      sig({ grille_id: 'b', gravite: 'faible', cree_le: '2026-11-21T10:00:00Z' }),
      sig({ grille_id: 'c', gravite: 'elevee', cree_le: '2026-11-01T10:00:00Z' }),
    ]);
    expect(trierEndroits(e).map((x) => x.cle)).toEqual(['grille:c', 'grille:b', 'grille:a']);
  });
});
