import type { EtapeSuivi } from '../types';

export type EtatEtape = 'fait' | 'courant' | 'avenir';

/**
 * Les trois étapes montrées au citoyen : Soumis, Prise en charge (planifié ou pris en charge), Terminé.
 * Les étapes passées sont « fait » (vert), la dernière atteinte est « courant » (orange) tant que tout n'est pas terminé.
 */
export function etatsDesEtapes(etape: EtapeSuivi): [EtatEtape, EtatEtape, EtatEtape] {
  if (etape === 'regle') return ['fait', 'fait', 'fait'];
  if (etape === 'planifie' || etape === 'pris_en_charge') return ['fait', 'courant', 'avenir'];
  return ['courant', 'avenir', 'avenir']; // reçu (le rejet est dit à part)
}
