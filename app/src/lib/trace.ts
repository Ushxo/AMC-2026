// Erreurs sans bruit : rien n'apparaît devant l'utilisateur, mais en développement chaque erreur est écrite dans le journal.
// Là où l'utilisateur attend un résultat (photo, position, enregistrement), l'écran montre sa propre phrase d'erreur.

declare const __DEV__: boolean | undefined;

const enDeveloppement = (): boolean => typeof __DEV__ !== 'undefined' && !!__DEV__;

/** Note une erreur attrapée (journal en développement seulement). */
export function tracer(contexte: string, erreur: unknown): void {
  if (enDeveloppement()) {
    console.warn(`[${contexte}]`, erreur);
  }
}

/** Lance une promesse (ou une fonction asynchrone) sans jamais laisser un rejet non traité. */
export function sansBruit(travail: PromiseLike<unknown> | (() => PromiseLike<unknown> | unknown), contexte: string): void {
  try {
    const p = typeof travail === 'function' ? travail() : travail;
    if (p && typeof (p as PromiseLike<unknown>).then === 'function') {
      (p as PromiseLike<unknown>).then(undefined, (e: unknown) => tracer(contexte, e));
    }
  } catch (e) {
    tracer(contexte, e);
  }
}

/** Exécute une fonction synchrone : une exception est tracée, jamais propagée. */
export function essayerSansBruit(f: () => void, contexte: string): void {
  try {
    f();
  } catch (e) {
    tracer(contexte, e);
  }
}
