import { tracer } from '@/lib/trace';

// Les ordres au contrôleur de la carte Google (caméra, repères, formes) passent tous par ici : un ordre envoyé alors que la vue native
// n'existe pas encore ou plus (« No view controller found for the specified nativeID ») est un rejet attendu, jamais une erreur
// non gérée. Chaque contexte n'est noté qu'une fois dans le journal (pas de répétition par appel).
const notes = new Set<string>();

function noter(contexte: string, erreur: unknown): void {
  if (notes.has(contexte)) return;
  notes.add(contexte);
  tracer(`carte Google : ${contexte}`, erreur);
}

/** Envoie un ordre au contrôleur : une exception ou un rejet est noté une fois, jamais propagé. */
export function appeler(contexte: string, ordre: () => unknown): void {
  try {
    const r = ordre();
    if (r && typeof (r as PromiseLike<unknown>).then === 'function') (r as PromiseLike<unknown>).then(undefined, (e: unknown) => noter(contexte, e));
  } catch (e) {
    noter(contexte, e);
  }
}

/** Lit une valeur auprès du contrôleur : null si l'appel échoue (la promesse rendue ne rejette jamais). */
export async function lire<T>(contexte: string, lecture: () => Promise<T>): Promise<T | null> {
  try {
    return await lecture();
  } catch (e) {
    noter(contexte, e);
    return null;
  }
}

export function reinitialiserNotes(): void {
  notes.clear();
}
