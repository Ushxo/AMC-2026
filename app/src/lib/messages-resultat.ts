// Mots du résultat d'un arrêt : fait (Oui) ou non fait (Non), avec un commentaire.

export const QUESTION_ARRET_FAIT = 'Arrêt fait ?';
export const MESSAGE_RESULTAT_MIGRATION = 'Cette fonction demande une mise à jour de la base.';
export const MESSAGE_NON_FAIT = 'Arrêt noté comme non fait. Les signalements de cet endroit restent ouverts.';
export const MESSAGE_NON_FAIT_LOCAL = 'Arrêt noté comme non fait sur ce téléphone. Les signalements de cet endroit restent ouverts.';
export const MESSAGE_COMMENTAIRE_OBLIGATOIRE = "Dites pourquoi l'arrêt n'a pas été fait.";
export const MESSAGE_COMMENTAIRE_SANS_BASE = "Arrêt fait. Le commentaire n'a pas pu être gardé : la base demande une mise à jour.";
export const LIMITE_COMMENTAIRE = 500;

/** Raisons en un toucher pour « Non » : elles remplissent le champ et restent modifiables. */
export const RAISONS_NON_FAIT = [
  'Grille brisée, à réparer',
  'Accès impossible',
  'Matériel manquant',
  "Besoin d'une autre équipe",
] as const;

/** Vérifie le commentaire d'un résultat. Non : obligatoire. Rend un message d'erreur, ou null. */
export function erreurCommentaire(fait: boolean, commentaire: string): string | null {
  const c = commentaire.trim();
  if (c.length > LIMITE_COMMENTAIRE) return `500 caractères au plus (${c.length}).`;
  if (!fait && c.length === 0) return MESSAGE_COMMENTAIRE_OBLIGATOIRE;
  return null;
}
