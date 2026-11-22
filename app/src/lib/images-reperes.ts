import type { EtatRepere } from '../components/ville/repere-egout';

/**
 * Noms des images de repères embarquées dans la build native (utilisées par la carte Google, qui n'accepte
 * qu'un NOM d'image du paquet). Générées par un script hors dépôt : repere_<HEX6>_<etat>[_<numero>].png.
 */
const COULEURS_COMPLETES = new Set(['7B8580', '2F7D32', 'F47B20', 'D9363E', '0072B2', 'D55E00', '009E73', 'CC79A7', 'E69F00', '56B4E9', 'F0E442', '000000']);
const COULEURS_PROCHAIN = new Set(['0072B2', 'D55E00', '009E73', 'CC79A7']);
const COULEUR_NUMEROS = '0072B2';
const NUMERO_MAX = 99;

export function hexSansDieze(couleur: string): string {
  return couleur.replace('#', '').toUpperCase();
}

/** Nom de l'image d'un repère ; se rabat sur l'image la plus proche qui existe. */
export function nomImageRepere(couleur: string, etat: EtatRepere = 'normal', numero?: number): string {
  const hex = hexSansDieze(couleur);
  if (etat === 'fait') return 'repere_7B8580_fait';
  if (numero !== undefined && hex === COULEUR_NUMEROS && numero >= 1 && numero <= NUMERO_MAX && (etat === 'normal' || etat === 'prochain')) {
    return `repere_${hex}_${etat}_${numero}`;
  }
  if (etat === 'prochain') return COULEURS_PROCHAIN.has(hex) ? `repere_${hex}_prochain` : `repere_${COULEURS_COMPLETES.has(hex) ? hex : '0072B2'}_normal`;
  const h = COULEURS_COMPLETES.has(hex) ? hex : '0072B2';
  return `repere_${h}_${etat}`;
}

export const NOM_IMAGE_VEHICULE = 'vehicule';

const NOMBRE_GROUPE_MAX = 99;

/**
 * Image d'un repère de groupe : nombre d'endroits écrit dans la goutte (« 99+ » au-delà de 99), point rouge si le groupe
 * contient un endroit élevé sans être rouge. Seulement les trois couleurs de gravité.
 */
export function nomImageGroupe(couleur: string, nombre: number, pointEleve: boolean): string {
  const hex = hexSansDieze(couleur);
  const h = ['2F7D32', 'F47B20', 'D9363E'].includes(hex) ? hex : '2F7D32';
  const n = nombre > NOMBRE_GROUPE_MAX ? '99plus' : String(Math.max(2, nombre));
  return `groupe_${h}_${n}${pointEleve && h !== 'D9363E' ? '_e' : ''}`;
}
