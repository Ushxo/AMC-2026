import { CATEGORIES_TOUTES, type Categorie, type ErreurValidation, type Gravite, type NouveauSignalement } from '../types';
import { dansMontreal } from './geo';

const CATEGORIES: Categorie[] = CATEGORIES_TOUTES;
const GRAVITES: Gravite[] = ['faible', 'moyenne', 'elevee'];

export const COMMENTAIRE_MAX = 500;

export function validerSignalement(n: NouveauSignalement): ErreurValidation[] {
  const erreurs: ErreurValidation[] = [];
  if (!CATEGORIES.includes(n.categorie)) {
    erreurs.push({ champ: 'categorie', message: 'Choisissez ce que vous signalez.' });
  }
  if (!GRAVITES.includes(n.gravite)) {
    erreurs.push({ champ: 'gravite', message: 'Choisissez la gravité du problème.' });
  }
  if (!dansMontreal({ latitude: n.latitude, longitude: n.longitude })) {
    erreurs.push({
      champ: 'latitude',
      message: 'Ce point est hors de Montréal. Déplacez-le sur la carte.',
    });
  }
  if (n.commentaire && n.commentaire.length > COMMENTAIRE_MAX) {
    erreurs.push({
      champ: 'commentaire',
      message: `Le commentaire est trop long (${COMMENTAIRE_MAX} caractères au plus).`,
    });
  }
  return erreurs;
}
