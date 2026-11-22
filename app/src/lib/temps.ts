// Heures de Montréal sans dépendre d'Intl : l'heure d'été va du 2e dimanche de mars (2 h) au 1er dimanche de novembre (2 h).

function dimancheN(annee: number, mois: number, n: number): number {
  const premier = new Date(Date.UTC(annee, mois, 1)).getUTCDay();
  return 1 + ((7 - premier) % 7) + (n - 1) * 7;
}

/** Décalage de Montréal par rapport à UTC, en minutes (-240 en été, -300 en hiver). */
export function decalageMontrealMin(instantMs: number): number {
  const annee = new Date(instantMs).getUTCFullYear();
  const debutEte = Date.UTC(annee, 2, dimancheN(annee, 2, 2), 7); // 2 h EST = 7 h UTC
  const finEte = Date.UTC(annee, 10, dimancheN(annee, 10, 1), 6); // 2 h EDT = 6 h UTC
  return instantMs >= debutEte && instantMs < finEte ? -240 : -300;
}

export type HeureLocale = { jour: string; heures: number; minutes: number };

/** Heure de Montréal d'un instant ISO (avec fuseau ou en UTC). Null si la date est invalide. */
export function heureMontreal(iso: string): HeureLocale | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const local = new Date(ms + decalageMontrealMin(ms) * 60000);
  return {
    jour: local.toISOString().slice(0, 10),
    heures: local.getUTCHours(),
    minutes: local.getUTCMinutes(),
  };
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0');
}

/** « 7 h 05 » */
export function formaterHeure(iso: string): string {
  const h = heureMontreal(iso);
  return h ? `${h.heures} h ${deuxChiffres(h.minutes)}` : '';
}

/** Arrondi au quart d'heure le plus proche : « 7 h 15 ». */
export function arrondirQuartHeure(iso: string): string {
  const h = heureMontreal(iso);
  if (!h) return '';
  const total = Math.round((h.heures * 60 + h.minutes) / 15) * 15;
  const heures = Math.floor(total / 60) % 24;
  return `${heures} h ${deuxChiffres(total % 60)}`;
}

/** « 7 h 05 » ou « 42 min » */
export function formaterDuree(secondes: number): string {
  const min = Math.round(secondes / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${deuxChiffres(min % 60)}`;
}

/** « 225,7 km » */
export function formaterKm(metres: number): string {
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
}

function ajouterUnJour(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
}

/**
 * Jour du PROCHAIN quart (AAAA-MM-JJ) : aujourd'hui si l'heure de Montréal précède le début du premier
 * quart, sinon demain. Une réoptimisation ne tombe ainsi jamais dans le passé. `debuts` : « HH:MM ».
 */
export function dateProchainQuart(maintenantMs: number, debuts: string[]): string {
  const h = heureMontreal(new Date(maintenantMs).toISOString());
  if (!h) return new Date(maintenantMs).toISOString().slice(0, 10);
  const minutes = h.heures * 60 + h.minutes;
  const premiers = debuts
    .map((d) => {
      const [hh, mm] = d.split(':').map(Number);
      return hh * 60 + (mm || 0);
    })
    .filter((v) => Number.isFinite(v));
  const premier = premiers.length > 0 ? Math.min(...premiers) : 0;
  return minutes < premier ? h.jour : ajouterUnJour(h.jour);
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_LONGS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « dimanche 22 novembre » depuis AAAA-MM-JJ, ou depuis un instant ISO (jour de Montréal). */
export function libelleJour(jourOuIso: string): string {
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(jourOuIso) ? jourOuIso : (heureMontreal(jourOuIso)?.jour ?? '');
  if (!jour) return '';
  const [a, m, j] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return `${JOURS[d.getUTCDay()]} ${j}${j === 1 ? 'er' : ''} ${MOIS_LONGS[m - 1]}`;
}
