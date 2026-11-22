import type { Gravite } from '../types';

/** Ce que dit l'analyse d'une photo, réduit à ce dont l'écran a besoin. */
export type AnalysePhoto = { valide: boolean; gravite: Gravite | null };

/** La gravité à suggérer : seulement si la photo montre bien un égout et que l'analyse donne une gravité. */
export function graviteSuggeree(a: AnalysePhoto | null | undefined): Gravite | null {
  return a && a.valide && a.gravite ? a.gravite : null;
}

export const MESSAGE_ANALYSE_INDISPONIBLE = "L'analyse de la photo n'est pas disponible : choisissez la gravité vous-même.";
export const MESSAGE_PHOTO_PAS_EGOUT = "La photo ne semble pas montrer un égout. Vous pouvez la changer, ou l'envoyer quand même.";

/** L'analyse n'existe que si l'adresse du service est réglée (EXPO_PUBLIC_ML_URL). */
export function analyseDisponible(): boolean {
  return !!process.env.EXPO_PUBLIC_ML_URL;
}
