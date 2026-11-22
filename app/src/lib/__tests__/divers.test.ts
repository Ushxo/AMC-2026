import { graviteSuggeree } from '../suggestion-gravite';
import { filtrerSignalements } from '../filtre';
import { adressePlusProche, chercherLocal, normaliser } from '../recherche';
import { calculerResume } from '../resume';
import { sig } from '../test-utils/fabrique';
import { uuidV4 } from '../uuid';

describe('filtre', () => {
  const liste = [
    sig({ etat: 'nouveau', categorie: 'grille_bouchee' }),
    sig({ etat: 'regle', categorie: 'autre' }),
  ];
  it('filtre par états et catégories', () => {
    expect(filtrerSignalements(liste)).toHaveLength(2);
    expect(filtrerSignalements(liste, { etats: ['regle'] })).toHaveLength(1);
    expect(filtrerSignalements(liste, { categories: ['grille_bouchee'], etats: ['nouveau'] })).toHaveLength(1);
    expect(filtrerSignalements(liste, { etats: [] })).toHaveLength(2);
  });
});

describe('resume', () => {
  it('compte par état et par catégorie', () => {
    const r = calculerResume([sig({ etat: 'nouveau' }), sig({ etat: 'nouveau' }), sig({ etat: 'rejete', categorie: 'autre' })]);
    expect(r.parEtat).toEqual({ nouveau: 2, pris_en_charge: 0, regle: 0, rejete: 1 });
    expect(r.parCategorie.grille_bouchee).toBe(2);
    expect(r.parCategorie.autre).toBe(1);
  });
});

describe('recherche locale', () => {
  const index = [
    { libelle: '123 rue Sainte-Catherine Ouest', latitude: 45.5, longitude: -73.57 },
    { libelle: '5 rue de la Commune', latitude: 45.50, longitude: -73.55 },
    { libelle: 'Catherine-Doherty 400', latitude: 45.5, longitude: -73.56 },
  ];
  it('ignore accents et casse', () => {
    expect(normaliser('  Été ')).toBe('ete');
    expect(chercherLocal('COMMUNE', index)).toHaveLength(1);
  });
  it('début avant contenu, 5 au plus, rien sous 2 lettres', () => {
    expect(chercherLocal('catherine', index).map((r) => r.libelle)[0]).toBe('Catherine-Doherty 400');
    expect(chercherLocal('c', index)).toEqual([]);
    const gros = Array.from({ length: 20 }, (_, i) => ({ libelle: `${i} rue Test`, latitude: 45.5, longitude: -73.5 }));
    expect(chercherLocal('rue', gros)).toHaveLength(5);
  });
});

describe('uuid', () => {
  it('rend un UUID v4 différent à chaque appel', () => {
    const a = uuidV4();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV4()).not.toBe(a);
  });
});

describe('adresse la plus proche', () => {
  it('rend la plus proche dans le rayon, sinon null', () => {
    const index = [
      { libelle: '100 rue A', latitude: 45.5, longitude: -73.57 },
      { libelle: '200 rue B', latitude: 45.5005, longitude: -73.57 },
    ];
    expect(adressePlusProche({ latitude: 45.50045, longitude: -73.57 }, index)?.libelle).toBe('200 rue B');
    expect(adressePlusProche({ latitude: 45.6, longitude: -73.57 }, index)).toBeNull();
  });
});

describe('suggestion de gravité par la photo', () => {
  it('seulement si la photo est valide et que l’analyse donne une gravité', () => {
    expect(graviteSuggeree({ valide: true, gravite: 'elevee' })).toBe('elevee');
    expect(graviteSuggeree({ valide: false, gravite: 'elevee' })).toBeNull();
    expect(graviteSuggeree({ valide: true, gravite: null })).toBeNull();
    expect(graviteSuggeree(null)).toBeNull();
  });
});
