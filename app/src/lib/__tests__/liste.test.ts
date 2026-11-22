import { libelleNombreEndroit } from '../format';
import { construireListe } from '../liste';
import { sig } from '../test-utils/fabrique';

describe('construireListe', () => {
  const tous = [
    sig({ grille_id: 'a', gravite: 'faible', cree_le: '2026-11-20T10:00:00Z' }),
    sig({ grille_id: 'b', gravite: 'faible', cree_le: '2026-11-21T10:00:00Z' }),
    sig({ grille_id: 'c', gravite: 'elevee', cree_le: '2026-11-01T10:00:00Z', etat: 'regle' }),
    ...Array.from({ length: 20 }, () => sig({ grille_id: 'd', cree_le: '2026-11-10T10:00:00Z' })),
  ];

  it('trie par gravité affichée puis par date', () => {
    expect(construireListe(tous).map((e) => e.cle)).toEqual(['grille:c', 'grille:d', 'grille:b', 'grille:a']);
  });

  it('le filtre d\u2019état garde seulement les endroits concernés', () => {
    expect(construireListe(tous, { etats: ['regle'] }).map((e) => e.cle)).toEqual(['grille:c']);
  });
});

describe('libelleNombreEndroit', () => {
  const reglesDeux = construireListe([sig({ grille_id: 'x', etat: 'regle' }), sig({ grille_id: 'x', etat: 'regle' })], {
    etats: ['regle'],
  })[0];

  it('ouverts par défaut', () => {
    const e = construireListe([sig({ grille_id: 'x' }), sig({ grille_id: 'x' })])[0];
    expect(libelleNombreEndroit(e, [])).toBe('2 signalements ouverts');
    expect(libelleNombreEndroit(e, ['nouveau'])).toBe('2 signalements ouverts');
  });

  it('filtre sur un état fermé : nombre de la liste filtrée', () => {
    expect(libelleNombreEndroit(reglesDeux, ['regle'])).toBe('2 signalements réglés');
    const rejete = construireListe([sig({ grille_id: 'y', etat: 'rejete' })], { etats: ['rejete'] })[0];
    expect(libelleNombreEndroit(rejete, ['rejete'])).toBe('1 signalement rejeté');
    expect(libelleNombreEndroit(reglesDeux, ['regle', 'rejete'])).toBe('2 signalements fermés');
  });
});

describe('liste du superviseur : seulement les endroits confirmés', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sig } = require('../test-utils/fabrique') as typeof import('../test-utils/fabrique');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calculerResume } = require('../resume') as typeof import('../resume');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sansNonConfirmes } = require('../gravite') as typeof import('../gravite');

  it('un signalement sans photo seul n’est ni listé ni compté ; avec photo vérifiée ou à trois, oui', () => {
    const seul = sig({ grille_id: 'a', photo_verifiee: false });
    const avecPhoto = sig({ grille_id: 'b', photo_verifiee: true });
    const trois = [1, 2, 3].map(() => sig({ grille_id: 'c', photo_verifiee: false }));
    const tous = [seul, avecPhoto, ...trois];
    expect(construireListe(tous).map((e) => e.cle).sort()).toEqual(['grille:b', 'grille:c']);
    expect(calculerResume(sansNonConfirmes(tous)).parEtat.nouveau).toBe(4);
  });
});
