import type { Endroit, Gravite } from '../../types';
import {
  basculerCle,
  basculerZone,
  clesDeZone,
  etatZone,
  libelleEtatZone,
  basculerGravite,
  clesOuvertes,
  compterSelection,
  libelleCompteur,
  nettoyerSelection,
  selectionAEnvoyer,
} from '../selection';

function e(cle: string, gravite: Gravite, nombre = 1): Endroit {
  return {
    cle,
    position: { latitude: 45.5, longitude: -73.56 },
    nombre,
    gravite_choisie_max: gravite,
    gravite_par_nombre: 'faible',
    gravite_affichee: gravite,
    etat_dominant: 'nouveau',
    signalements: [],
  };
}

const endroits = [e('a', 'elevee'), e('b', 'elevee'), e('c', 'moyenne'), e('d', 'faible'), e('ferme', 'faible', 0)];

describe('sélection des endroits', () => {
  it('seuls les endroits ouverts sont sélectionnables', () => {
    expect(clesOuvertes(endroits)).toEqual(['a', 'b', 'c', 'd']);
    expect(nettoyerSelection(['a', 'a', 'ferme', 'inconnu', 'd'], endroits)).toEqual(['a', 'd']);
  });

  it('un bouton de gravité sélectionne tout ce niveau, puis le désélectionne', () => {
    let cles = basculerGravite([], endroits, 'elevee');
    expect(cles.sort()).toEqual(['a', 'b']);
    cles = basculerGravite(cles, endroits, 'moyenne');
    expect(cles.sort()).toEqual(['a', 'b', 'c']);
    cles = basculerGravite(cles, endroits, 'elevee');
    expect(cles).toEqual(['c']);
  });

  it('si une partie du niveau est déjà choisie, le bouton complète le niveau', () => {
    expect(basculerGravite(['a'], endroits, 'elevee').sort()).toEqual(['a', 'b']);
  });

  it('un niveau sans endroit ne change rien', () => {
    expect(basculerGravite(['d'], [e('d', 'faible')], 'elevee')).toEqual(['d']);
  });

  it('toucher un repère ajoute ou retire', () => {
    expect(basculerCle(['a'], 'b')).toEqual(['a', 'b']);
    expect(basculerCle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('compteur par gravité et libellé', () => {
    const c = compterSelection(['a', 'b', 'c', 'ferme', 'inconnu'], endroits);
    expect(c).toEqual({ total: 3, elevee: 2, moyenne: 1, faible: 0 });
    expect(libelleCompteur(c)).toBe('3 endroits sélectionnés (2 élevés, 1 moyen, 0 faible)');
    expect(libelleCompteur(compterSelection(['d'], endroits))).toBe('1 endroit sélectionné (0 élevé, 0 moyen, 1 faible)');
  });

  it('à envoyer : rien quand tout est choisi, sinon la liste propre', () => {
    expect(selectionAEnvoyer(['a', 'b', 'c', 'd'], endroits)).toBeUndefined();
    expect(selectionAEnvoyer(['a', 'ferme'], endroits)).toEqual(['a']);
    expect(selectionAEnvoyer([], endroits)).toEqual([]);
  });
});

describe('sélection par zone', () => {
  const avec = (cle: string, ids: string[], nombre = 1): Endroit => ({
    ...e(cle, 'moyenne', nombre),
    signalements: ids.map((id) => ({ id }) as Endroit['signalements'][number]),
  });
  const lieux = [avec('p', ['s1', 's2']), avec('q', ['s3']), avec('r', ['s4']), avec('ferme', ['s5'], 0)];
  const zone = { signalement_ids: ['s1', 's3', 's5'] };

  it('les endroits ouverts d’une zone sont ceux qui ont un de ses signalements', () => {
    expect(clesDeZone(zone, lieux)).toEqual(['p', 'q']); // « ferme » n'est pas ouvert, « r » est hors zone
  });

  it('état : aucune, certaines, toutes ; une zone vide compte pour aucune', () => {
    expect(etatZone([], ['p', 'q'])).toBe('aucune');
    expect(etatZone(['p'], ['p', 'q'])).toBe('certaines');
    expect(etatZone(['p', 'q', 'r'], ['p', 'q'])).toBe('toutes');
    expect(etatZone(['p'], [])).toBe('aucune');
  });

  it('toucher une zone : sélectionne tout ; si tout y est déjà, retire tout ; le reste de la sélection est gardé', () => {
    expect(basculerZone(['r'], ['p', 'q']).sort()).toEqual(['p', 'q', 'r']);
    expect(basculerZone(['p'], ['p', 'q']).sort()).toEqual(['p', 'q']); // certaines → toutes
    expect(basculerZone(['p', 'q', 'r'], ['p', 'q'])).toEqual(['r']);
    expect(basculerZone(['r'], [])).toEqual(['r']);
  });

  it('libellé d’accessibilité de l’état', () => {
    expect(libelleEtatZone(3, 'toutes')).toBe('3 endroits dans la zone : tous les endroits sélectionnés');
    expect(libelleEtatZone(1, 'aucune')).toBe('1 endroit dans la zone : aucun endroit sélectionné');
    expect(libelleEtatZone(2, 'certaines')).toContain('certains');
  });
});
