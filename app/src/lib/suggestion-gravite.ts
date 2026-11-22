import type { Gravite } from '../types';
import { graviteMax, graviteParNombre } from './gravite';

/** Ce que dit l'analyse d'une photo, réduit à ce dont l'écran a besoin. */
export type AnalysePhoto = { valide: boolean; gravite: Gravite | null };

/** La gravité donnée par l'analyse : seulement si la photo montre bien un égout et que l'analyse donne une gravité. */
export function graviteSuggeree(a: AnalysePhoto | null | undefined): Gravite | null {
  return a && a.valide && a.gravite ? a.gravite : null;
}

/** Gravité enregistrée quand l'analyse ne peut pas en donner une (pas de photo, photo hors sujet, service injoignable). */
export const GRAVITE_SANS_ANALYSE: Gravite = 'faible';

/** La gravité du signalement vient de l'analyse de la photo ; le citoyen ne la choisit plus. */
export function graviteDuSignalement(a: AnalysePhoto | null | undefined): Gravite {
  return graviteSuggeree(a) ?? GRAVITE_SANS_ANALYSE;
}

/**
 * Priorité de l'endroit une fois ce signalement envoyé : la plus haute entre la gravité
 * de la photo et celle que donne le nombre de signalements non résolus au même endroit
 * (celui-ci compris). Même règle que regrouper() dans gravite.ts.
 */
export function prioriteEndroit(gravite: Gravite, nonResolusAvant: number): Gravite {
  return graviteMax(gravite, graviteParNombre(nonResolusAvant + 1));
}

// Messages pour le citoyen : on lui dit seulement si sa photo montre un égout, jamais le niveau de gravité.
export const MESSAGE_PHOTO_EN_VERIFICATION = 'Vérification de la photo…';
export const MESSAGE_PHOTO_ACCEPTEE = 'Photo acceptée : on voit bien un égout.';
export const MESSAGE_PHOTO_PAS_EGOUT = "Cette photo ne montre pas un égout. Prenez une photo de l'égout ou de la grille.";
export const MESSAGE_ANALYSE_INDISPONIBLE = "La photo n'a pas pu être vérifiée pour l'instant. Elle sera jointe telle quelle.";

/** L'analyse passe par la fonction serveur : elle n'existe que si l'adresse du serveur est réglée. */
export function analyseDisponible(): boolean {
  return !!process.env.EXPO_PUBLIC_SUPABASE_URL;
}
