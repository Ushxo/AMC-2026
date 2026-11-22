import { MESSAGE_ENVOI_REFUSE, MESSAGE_PHOTO_TROP_LOURDE } from './messages';

type ErreurBrute = { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown };

/**
 * Refus permanent (photo trop lourde, ligne refusée par la base) ou panne passagère (réseau, délai, serveur).
 * Un refus permanent ne se règle pas en réessayant.
 */
export function analyserErreurEnvoi(e: unknown): { permanent: boolean; motif: string } {
  const err = (typeof e === 'object' && e !== null ? e : {}) as ErreurBrute;
  const message = typeof err.message === 'string' ? err.message : '';
  const statut = Number(err.statusCode ?? err.status);
  const code = typeof err.code === 'string' ? err.code : '';
  // Nouvelle catégorie pas encore acceptée par la base (migration 0008 pas lancée) : ce n'est pas un refus définitif.
  // Le signalement reste dans la file du téléphone et repart tout seul quand la base l'accepte.
  if ((code === '22P02' || code === '23514' || statut === 400) && /categorie|enum|check constraint/i.test(message)) {
    return { permanent: false, motif: '' };
  }
  if (statut === 413 || /exceeded the maximum|too large|payload too large/i.test(message)) {
    return { permanent: true, motif: MESSAGE_PHOTO_TROP_LOURDE };
  }
  if (statut >= 400 && statut < 500 && statut !== 408 && statut !== 429) {
    return { permanent: true, motif: MESSAGE_ENVOI_REFUSE };
  }
  if (/^(22|23|42|PGRST)/.test(code)) return { permanent: true, motif: MESSAGE_ENVOI_REFUSE };
  return { permanent: false, motif: '' };
}
