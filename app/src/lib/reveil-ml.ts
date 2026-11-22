// Réveil du service d'analyse des photos (il s'endort quand personne ne l'utilise) : une seule fois par session,
// sans attendre ni bloquer, erreurs avalées. Le module d'analyse n'est chargé qu'au moment du réveil.

import { tracer } from './trace';

let fait = false;

export function reveillerUneFois(): void {
  if (fait || !process.env.EXPO_PUBLIC_SUPABASE_URL) return;
  fait = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reveillerServeurML } = require('./ml') as typeof import('./ml');
    void reveillerServeurML().catch((e) => tracer('réveil du service d’analyse', e));
  } catch {
    // module d'analyse absent : rien à réveiller
  }
}

export function reinitialiserReveil(): void {
  fait = false;
}
