import { LIBELLES_ETAT } from '../types';
import type { Endroit, Etat } from '../types';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 21 nov. 2026, 14 h 05 » à l'heure de l'appareil. Texte vide si la date est invalide. */
export function formaterDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}, ${d.getHours()} h ${min}`;
}

export function formaterNombre(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

export function formaterPosition(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** « n signalements ouverts », ou le nombre de la liste filtrée quand seuls des états fermés sont filtrés. */
export function libelleNombreEndroit(e: Endroit, etats: Etat[]): string {
  const fermesSeulement = etats.length > 0 && etats.every((x) => x === 'regle' || x === 'rejete');
  if (!fermesSeulement) return formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
  const n = e.signalements.length;
  if (etats.length === 1) {
    const mot = LIBELLES_ETAT[etats[0]].toLowerCase();
    return formaterNombre(n, `signalement ${mot}`, `signalements ${mot}s`);
  }
  return formaterNombre(n, 'signalement fermé', 'signalements fermés');
}
