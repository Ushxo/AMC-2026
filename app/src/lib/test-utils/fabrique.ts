import type { Signalement } from '../../types';

let n = 0;
export function sig(p: Partial<Signalement> = {}): Signalement {
  n += 1;
  return {
    id: `id-${n}`,
    origine: 'citoyen',
    cree_le: '2026-11-20T10:00:00.000Z',
    latitude: 45.505,
    longitude: -73.567,
    categorie: 'grille_bouchee',
    gravite: 'faible',
    commentaire: null,
    photo_url: null,
    grille_id: null,
    etat: 'nouveau',
    etat_change_le: '2026-11-20T10:00:00.000Z',
    exemple_demo: false,
    ...p,
  };
}
