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

let installe = false;

/**
 * Gestionnaires globaux, installés une seule fois au démarrage (appelé par `_layout.tsx`) :
 * les rejets non traités sont tracés et leurs messages masqués en développement ; les erreurs JavaScript non fatales sont
 * tracées sans interrompre l'app ; les erreurs fatales suivent le chemin normal.
 */
export function installerGestionnaires(): void {
  if (installe) return;
  installe = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LogBox } = require('react-native') as typeof import('react-native');
    LogBox?.ignoreLogs?.(['Uncaught (in promise)', 'Possible unhandled promise rejection', 'Possible Unhandled Promise Rejection']);
  } catch {
    // pas de LogBox (tests, web)
  }
  try {
    if (enDeveloppement()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const suivi = require('promise/setimmediate/rejection-tracking') as { enable: (o: object) => void };
      suivi.enable({ allRejections: true, onUnhandled: (_id: number, e: unknown) => tracer('rejet non traité', e) });
    }
  } catch {
    // suivi des rejets absent : rien à régler
  }
  try {
    const utilitaires = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
    if (utilitaires) {
      const precedent = utilitaires.getGlobalHandler();
      utilitaires.setGlobalHandler((e, fatal) => {
        tracer(fatal ? 'erreur fatale' : 'erreur non fatale', e);
        if (fatal) precedent?.(e, fatal);
      });
    }
  } catch {
    // pas de gestionnaire d'erreurs globales : rien à régler
  }
}

export function reinitialiserGestionnaires(): void {
  installe = false;
}
