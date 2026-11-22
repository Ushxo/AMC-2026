// Mots du seuil d'apparition selon la photo : une photo acceptée suffit, sinon il faut plusieurs signalements au même endroit.

export const MESSAGE_ASTUCE_PHOTO = 'Avec une photo, votre signalement apparaît tout de suite sur la carte.';
export const MESSAGE_RECU_SUR_CARTE = 'Signalement reçu. Il est sur la carte.';
export const MESSAGE_RECU_SANS_CONFIRMATION =
  "Signalement reçu. Il apparaîtra sur la carte quand d'autres personnes signaleront le même endroit, ou avec une photo acceptée.";
/** La base n'a pas la colonne de la photo vérifiée : aucune promesse d'attente. */
export const MESSAGE_RECU_SIMPLE = 'Signalement reçu.';
export const MESSAGE_GARDE_HORS_LIGNE = 'Signalement gardé sur ce téléphone. Il partira au retour du réseau.';
export const ETIQUETTE_EN_ATTENTE_CONFIRMATION = 'En attente de confirmation';
export const ETIQUETTE_CONFIRME = 'Confirmé';

/** Ce qu'il manque pour que l'endroit apparaisse sur la carte. */
export function phraseManque(n: number): string {
  const nombre = Math.max(1, Math.round(n));
  return `Il manque ${nombre} signalement${nombre > 1 ? 's' : ''} au même endroit, ou une photo acceptée.`;
}
