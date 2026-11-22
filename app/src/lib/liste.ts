import type { Endroit, Signalement } from '../types';
import { filtrerSignalements, type FiltreSignalements } from './filtre';
import { regrouper, trierEndroits } from './gravite';

/** Liste du mode Ville : filtrée, regroupée par endroit, triée (gravité affichée puis date). */
export function construireListe(signalements: Signalement[], filtre?: FiltreSignalements): Endroit[] {
  return trierEndroits(regrouper(filtrerSignalements(signalements, filtre)));
}
