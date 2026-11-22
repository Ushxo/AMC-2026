import type { Coordonnees, Signalement } from '../types';
import type { EntreeAdresse } from './officiel';
import { normaliser } from './recherche';

/** Une adresse plus loin que cela du signalement ne dit pas sur quelle rue il se trouve. */
export const RAYON_RUE_M = 80;
/** Seules les adresses de la même rue à cette distance au plus servent à trouver la direction de la rue. */
export const RAYON_VOISINS_M = 220;
/** Demi-longueur de la bande autour du signalement (bande d'environ 90 m). */
export const DEMI_LONGUEUR_M = 45;
/** Il faut au moins un voisin de la même rue à cette distance pour connaître la direction. */
export const ECART_MIN_M = 15;
/** Deux bandes de la même rue plus proches que cela n'en font qu'une. */
export const FUSION_M = 140;

export type BandeEau = {
  id: string;
  /** Nom de la rue, sans numéro civique. */
  rue: string;
  /** Les deux bouts de la bande, le long de la rue. */
  points: [Coordonnees, Coordonnees];
  signalement_ids: string[];
};

const M_LAT = 110540;

type Local = { x: number; y: number };

function enMetres(origine: Coordonnees, p: { latitude: number; longitude: number }): Local {
  return { x: (p.longitude - origine.longitude) * 111320 * Math.cos((origine.latitude * Math.PI) / 180), y: (p.latitude - origine.latitude) * M_LAT };
}

function distanceLocale(l: Local): number {
  return Math.hypot(l.x, l.y);
}

function enDegres(origine: Coordonnees, l: Local): Coordonnees {
  return {
    latitude: origine.latitude + l.y / M_LAT,
    longitude: origine.longitude + l.x / (111320 * Math.cos((origine.latitude * Math.PI) / 180)),
  };
}

/** « 1244-1256 rue Barré » devient « rue Barré ». */
export function nomDeRue(libelle: string): string {
  return libelle.replace(/^\s*\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?\s+/, '').trim();
}

type Candidate = { rue: string; cle: string; centre: Coordonnees; u: Local; ids: string[] };

/** Direction de la rue au signalement, d'après les adresses voisines de la même rue ; null si on ne peut pas la connaître. */
function candidate(s: Signalement, adresses: EntreeAdresse[]): Candidate | null {
  const centre = { latitude: s.latitude, longitude: s.longitude };
  let proche: { d: number; a: EntreeAdresse } | null = null;
  const locales = adresses.map((a) => ({ a, l: enMetres(centre, a) }));
  for (const { a, l } of locales) {
    const d = Math.hypot(l.x, l.y);
    if (d <= RAYON_RUE_M && (!proche || d < proche.d)) proche = { d, a };
  }
  if (!proche) return null;
  const rue = nomDeRue(proche.a.libelle);
  const cle = normaliser(rue);
  const voisins = locales.filter(({ a, l }) => Math.hypot(l.x, l.y) <= RAYON_VOISINS_M && normaliser(nomDeRue(a.libelle)) === cle).map(({ l }) => l);
  if (!voisins.some((l) => Math.hypot(l.x, l.y) >= ECART_MIN_M)) return null;
  const pts: Local[] = [{ x: 0, y: 0 }, ...voisins];
  const mx = pts.reduce((t, p) => t + p.x, 0) / pts.length;
  const my = pts.reduce((t, p) => t + p.y, 0) / pts.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { rue, cle, centre, u: { x: Math.cos(angle), y: Math.sin(angle) }, ids: [s.id] };
}

/**
 * Bandes d'inondation : pour chaque rue touchée par de l'eau accumulée (signalements actifs), un tronçon d'environ 90 m
 * le long de la rue, trouvé avec l'index d'adresses (pas de réseau routier dans l'app). Plusieurs signalements proches
 * sur la même rue donnent une seule bande. Rue introuvable ou direction inconnue : rien n'est dessiné.
 */
export function bandesInondation(signalements: Signalement[], adresses: EntreeAdresse[]): BandeEau[] {
  const actifs = signalements.filter((s) => s.categorie === 'eau_accumulee' && (s.etat === 'nouveau' || s.etat === 'pris_en_charge'));
  const groupes: Candidate[][] = [];
  for (const s of actifs) {
    const c = candidate(s, adresses);
    if (!c) continue;
    const g = groupes.find((m) => m[0].cle === c.cle && m.some((x) => distanceLocale(enMetres(x.centre, c.centre)) <= FUSION_M));
    if (g) g.push(c);
    else groupes.push([c]);
  }
  return groupes.map((g) => {
    const [premier] = g;
    let min = Infinity;
    let max = -Infinity;
    for (const c of g) {
      const l = enMetres(premier.centre, c.centre);
      const t = l.x * premier.u.x + l.y * premier.u.y;
      min = Math.min(min, t - DEMI_LONGUEUR_M);
      max = Math.max(max, t + DEMI_LONGUEUR_M);
    }
    return {
      id: `bande-${premier.cle}-${premier.ids[0]}`,
      rue: premier.rue,
      points: [enDegres(premier.centre, { x: premier.u.x * min, y: premier.u.y * min }), enDegres(premier.centre, { x: premier.u.x * max, y: premier.u.y * max })],
      signalement_ids: g.flatMap((c) => c.ids),
    };
  });
}

export function libelleBande(b: Pick<BandeEau, 'rue'>): string {
  return `Eau accumulée sur ${b.rue}`;
}
