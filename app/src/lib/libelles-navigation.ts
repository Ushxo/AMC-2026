import { distanceCourte } from './navigation';

/** « 4 min », « 1 h 05 », « moins d'une minute » : le temps jusqu'au prochain arrêt. */
export function libelleTempsRestant(secondes: number): string {
  if (!Number.isFinite(secondes) || secondes < 0) return '';
  if (secondes < 60) return "moins d'une minute";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** La grosse ligne du panneau : « 4 min · 1,2 km » (prochain arrêt). Vide quand ni le temps ni la distance ne sont connus. */
export function libelleProchainArret(restant: { secondes: number; metres: number } | null): string | null {
  if (!restant) return null;
  const temps = libelleTempsRestant(restant.secondes);
  const distance = Number.isFinite(restant.metres) && restant.metres >= 0 ? distanceCourte(restant.metres) : '';
  const parts = [temps, distance].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** « Égout bouché · Près de 900 place Jean-Paul-Riopelle » : le problème et l'adresse de l'arrêt, en une ligne. */
export function libelleProblemeEtLieu(probleme: string, lieu: string): string | null {
  const parts = [probleme.trim(), lieu.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Nombre d'arrêts après le prochain qui restent numérotés en clair sur la carte de navigation. */
export const ARRETS_EN_CLAIR_APRES_PROCHAIN = 2;

/**
 * État d'un repère d'arrêt sur la carte de navigation : « fait » (gris), « prochain » (halo), les deux suivants en clair,
 * tous les autres atténués (ils ne noient pas le tracé).
 */
export function etatArretNavigation<A extends { rang: number }>(
  a: A,
  arrets: A[],
  courant: A | null | undefined,
  estFait: (a: A) => boolean,
): 'fait' | 'prochain' | 'normal' | 'attenue' {
  if (estFait(a)) return 'fait';
  if (courant && a.rang === courant.rang) return 'prochain';
  if (!courant) return 'normal';
  const apres = arrets
    .filter((x) => !estFait(x) && x.rang > courant.rang)
    .sort((x, y) => x.rang - y.rang)
    .slice(0, ARRETS_EN_CLAIR_APRES_PROCHAIN);
  return apres.some((x) => x.rang === a.rang) ? 'normal' : 'attenue';
}
