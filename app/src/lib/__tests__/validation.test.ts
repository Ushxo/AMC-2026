import type { NouveauSignalement } from '../../types';
import { validerSignalement } from '../validation';

const ok: NouveauSignalement = {
  latitude: 45.505,
  longitude: -73.567,
  categorie: 'grille_bouchee',
  gravite: 'moyenne',
};

describe('validerSignalement', () => {
  it('accepte un signalement valide', () => {
    expect(validerSignalement(ok)).toEqual([]);
    expect(validerSignalement({ ...ok, commentaire: 'x'.repeat(500) })).toEqual([]);
  });

  it('refuse catégorie, gravité, point et commentaire invalides', () => {
    const e = validerSignalement({
      latitude: 46.8,
      longitude: -71.2,
      categorie: undefined as never,
      gravite: undefined as never,
      commentaire: 'x'.repeat(501),
    });
    expect(e.map((x) => x.champ).sort()).toEqual(['categorie', 'commentaire', 'gravite', 'latitude']);
    expect(e.find((x) => x.champ === 'latitude')?.message).toBe(
      'Ce point est hors de Montréal. Déplacez-le sur la carte.',
    );
  });
});
