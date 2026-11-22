import type { Endroit, Gravite } from '../../types';
import {
  basculerCle,
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
