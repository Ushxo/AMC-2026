import type { Endroit, Signalement } from '../types';
import { filtrerSignalements, type FiltreSignalements } from './filtre';
import { regrouper, sansNonConfirmes, trierEndroits } from './gravite';

/**
 * Liste du mode Ville : seulement les endroits confirmés (la confirmation se juge sur tous les signalements de l'endroit,
 * avant les filtres), filtrée, regroupée par endroit, triée (gravité affichée puis date).
 */
export function construireListe(signalements: Signalement[], filtre?: FiltreSignalements): Endroit[] {
  return trierEndroits(regrouper(filtrerSignalements(sansNonConfirmes(signalements), filtre)));
}
