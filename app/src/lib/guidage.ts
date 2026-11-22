import type { Coordonnees } from '../types';
import { distanceM } from './geo';
import { capEntre, distanceCourte } from './navigation';

export type IconeManoeuvre =
  | 'droit'
  | 'gauche'
  | 'droite'
  | 'leger-gauche'
  | 'leger-droite'
  | 'serre-gauche'
  | 'serre-droite'
  | 'demi-tour'
  | 'rond-point'
  | 'arrivee';

/** Une étape de la route : la manœuvre qui la COMMENCE, puis le trajet jusqu'à la manœuvre suivante. */
export type EtapeGuidage = {
  icone: IconeManoeuvre;
  /** Phrase de la manœuvre qui commence cette étape (« Tournez à gauche sur rue Wellington »). */
  texte: string;
  point: Coordonnees;
  points: Coordonnees[];
  distance_m: number;
  duree_s: number;
};

export const SEUIL_ARRIVEE_M = 30;
const SEUIL_MANOEUVRE_PASSEE_M = 12;
const PROCHE_MANOEUVRE_M = 30;

function sur(nom: string): string {
  return nom ? ` sur ${nom}` : '';
}

function ordinal(n: number): string {
  return n === 1 ? '1re' : `${n}e`;
}

function cote(modificateur: string | undefined): 'gauche' | 'droite' | null {
  if (!modificateur) return null;
  if (modificateur.includes('left')) return 'gauche';
  if (modificateur.includes('right')) return 'droite';
  return null;
}

function iconeDepuisModificateur(modificateur: string | undefined): IconeManoeuvre {
  switch (modificateur) {
    case 'left':
      return 'gauche';
    case 'right':
      return 'droite';
    case 'slight left':
      return 'leger-gauche';
    case 'slight right':
      return 'leger-droite';
    case 'sharp left':
      return 'serre-gauche';
    case 'sharp right':
      return 'serre-droite';
    case 'uturn':
      return 'demi-tour';
    default:
      return 'droit';
  }
}

function virage(modificateur: string | undefined): string {
  switch (modificateur) {
    case 'left':
      return 'Tournez à gauche';
    case 'right':
      return 'Tournez à droite';
    case 'slight left':
      return 'Tournez légèrement à gauche';
    case 'slight right':
      return 'Tournez légèrement à droite';
    case 'sharp left':
      return 'Tournez franchement à gauche';
    case 'sharp right':
      return 'Tournez franchement à droite';
    case 'uturn':
      return 'Faites demi-tour';
    default:
      return 'Continuez tout droit';
  }
}

/** Traduit une manœuvre OSRM (type + modificateur) en français simple. Nom de rue absent : pas de « sur ». */
export function traduireManoeuvre(
  type: string,
  modificateur: string | undefined,
  nom: string,
  sortie?: number,
): { icone: IconeManoeuvre; texte: string } {
  const n = (nom ?? '').trim();
  switch (type) {
    case 'depart':
      return { icone: 'droit', texte: n ? `Partez${sur(n)}` : 'Partez' };
    case 'arrive': {
      const c = cote(modificateur);
      return {
        icone: 'arrivee',
        texte: c ? `Votre destination est sur votre ${c}` : 'Vous arrivez à destination',
      };
    }
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn': {
      const debut = sortie ? `Au rond-point, prenez la ${ordinal(sortie)} sortie` : 'Au rond-point, continuez';
      return { icone: 'rond-point', texte: `${debut}${sur(n)}` };
    }
    case 'exit roundabout':
    case 'exit rotary':
      return { icone: 'droit', texte: `Sortez du rond-point${sur(n)}` };
    case 'new name':
      return { icone: 'droit', texte: n ? `Continuez${sur(n)}` : 'Continuez' };
    case 'continue':
      if (!modificateur || modificateur === 'straight') return { icone: 'droit', texte: n ? `Continuez${sur(n)}` : 'Continuez' };
      return { icone: iconeDepuisModificateur(modificateur), texte: `${virage(modificateur)}${sur(n)}` };
    case 'merge':
      return { icone: iconeDepuisModificateur(modificateur), texte: `Insérez-vous${sur(n)}` };
    case 'on ramp':
      return { icone: iconeDepuisModificateur(modificateur), texte: `Prenez la bretelle${sur(n)}` };
    case 'off ramp':
      return { icone: iconeDepuisModificateur(modificateur), texte: `Prenez la sortie${sur(n)}` };
    case 'fork': {
      const c = cote(modificateur);
      return {
        icone: iconeDepuisModificateur(modificateur),
        texte: c ? `Gardez votre ${c}${sur(n)}` : `Continuez${sur(n)}`,
      };
    }
    case 'end of road': {
      const c = cote(modificateur);
      return {
        icone: iconeDepuisModificateur(modificateur),
        texte: c ? `Au bout de la rue, tournez à ${c === 'gauche' ? 'gauche' : 'droite'}${sur(n)}` : `Continuez${sur(n)}`,
      };
    }
    case 'turn':
      return { icone: iconeDepuisModificateur(modificateur), texte: `${virage(modificateur)}${sur(n)}` };
    default:
      return { icone: iconeDepuisModificateur(modificateur), texte: n ? `Continuez${sur(n)}` : 'Continuez' };
  }
}

type PointOsrm = [number, number];

function pointsDe(geometrie: unknown): Coordonnees[] {
  const c = (geometrie as { coordinates?: unknown } | null)?.coordinates;
  if (!Array.isArray(c)) return [];
  return c
    .filter((p): p is PointOsrm => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number')
    .map(([longitude, latitude]) => ({ latitude, longitude }));
}

/** Étapes de guidage d'une réponse OSRM (steps=true). Liste vide si la réponse n'en contient pas. */
export function etapesDepuisOsrm(corps: unknown): EtapeGuidage[] {
  const pas = (corps as { routes?: { legs?: { steps?: unknown }[] }[] } | null)?.routes?.[0]?.legs?.[0]?.steps;
  if (!Array.isArray(pas)) return [];
  const etapes: EtapeGuidage[] = [];
  for (const s of pas as Record<string, unknown>[]) {
    const m = s.maneuver as { type?: string; modifier?: string; exit?: number; location?: PointOsrm } | undefined;
    if (!m?.type || !Array.isArray(m.location)) continue;
    const { icone, texte } = traduireManoeuvre(m.type, m.modifier, String(s.name ?? ''), m.exit);
    const points = pointsDe(s.geometry);
    etapes.push({
      icone,
      texte,
      point: { latitude: m.location[1], longitude: m.location[0] },
      points: points.length > 0 ? points : [{ latitude: m.location[1], longitude: m.location[0] }],
      distance_m: Number(s.distance) || 0,
      duree_s: Number(s.duration) || 0,
    });
  }
  return etapes;
}

/** Projette p sur le tracé : distance au tracé et distance restante jusqu'au bout du tracé. */
export function projeterSurTrace(p: Coordonnees, points: Coordonnees[]): { ecartM: number; restantM: number } {
  if (points.length === 0) return { ecartM: Infinity, restantM: 0 };
  if (points.length === 1) return { ecartM: distanceM(p, points[0]), restantM: 0 };
  const kx = Math.cos((p.latitude * Math.PI) / 180) * 111320;
  const ky = 110540;
  let meilleur = { ecartM: Infinity, indice: 0, t: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const ax = (points[i].longitude - p.longitude) * kx;
    const ay = (points[i].latitude - p.latitude) * ky;
    const bx = (points[i + 1].longitude - p.longitude) * kx;
    const by = (points[i + 1].latitude - p.latitude) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < meilleur.ecartM) meilleur = { ecartM: d, indice: i, t };
  }
  const i = meilleur.indice;
  let restant = (1 - meilleur.t) * distanceM(points[i], points[i + 1]);
  for (let k = i + 1; k < points.length - 1; k++) restant += distanceM(points[k], points[k + 1]);
  return { ecartM: meilleur.ecartM, restantM: restant };
}

export type Guidage = {
  /** etapes : guidage de la route ; arrive : à moins de 30 m de l'arrêt ; droite : pas de route, simple direction. */
  statut: 'etapes' | 'arrive' | 'droite';
  icone: IconeManoeuvre;
  instruction: string;
  suivante: string | null;
  /** Distance jusqu'à la prochaine manœuvre (m), ou jusqu'à l'arrêt. */
  distanceManoeuvre_m: number;
  index: number;
};

const POINTS_CARDINAUX = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];

export function directionCardinale(cap: number): string {
  return POINTS_CARDINAUX[Math.round((((cap % 360) + 360) % 360) / 45) % 8];
}

function minuscule(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Destination qui n'est pas un arrêt (garage, endroit de fin) : les mots à employer. */
export type DestinationNommee = { arrivee: string; direction: string };

export function messageArrivee(numeroArret: number, dest?: DestinationNommee): string {
  return dest ? `Vous êtes arrivé ${dest.arrivee}` : `Vous êtes arrivé à l'arrêt ${numeroArret}`;
}

export const MESSAGE_GUIDAGE_INDISPONIBLE = 'Guidage indisponible';

/** Sans route (réseau, service en panne) : on ne donne que la direction de l'arrêt. */
export function guidageDroit(position: Coordonnees, cible: Coordonnees, numeroArret: number, dest?: DestinationNommee): Guidage {
  const d = distanceM(position, cible);
  if (d < SEUIL_ARRIVEE_M) {
    return { statut: 'arrive', icone: 'arrivee', instruction: messageArrivee(numeroArret, dest), suivante: null, distanceManoeuvre_m: d, index: 0 };
  }
  const direction = directionCardinale(capEntre(position, cible));
  return {
    statut: 'droite',
    icone: 'droit',
    instruction: `${MESSAGE_GUIDAGE_INDISPONIBLE} : direction ${dest ? dest.direction : `de l'arrêt ${numeroArret}`}, vers le ${direction}, à ${distanceCourte(d)}`,
    suivante: null,
    distanceManoeuvre_m: d,
    index: 0,
  };
}

/**
 * Guidage à partir de la position : étape courante (la plus proche du tracé), distance restante jusqu'à la
 * prochaine manœuvre, puis la manœuvre d'après. La manœuvre est « passée » à moins de 12 m de son point.
 */
export function calculerGuidage(p: {
  position: Coordonnees;
  etapes: EtapeGuidage[];
  numeroArret: number;
  destination: Coordonnees;
  /** Destination qui n'est pas un arrêt (garage, fin de la tournée). */
  dest?: DestinationNommee;
}): Guidage {
  const { position, etapes, numeroArret, destination, dest } = p;
  if (etapes.length === 0) return guidageDroit(position, destination, numeroArret, dest);
  if (distanceM(position, destination) < SEUIL_ARRIVEE_M) {
    return { statut: 'arrive', icone: 'arrivee', instruction: messageArrivee(numeroArret, dest), suivante: null, distanceManoeuvre_m: distanceM(position, destination), index: etapes.length - 1 };
  }
  let index = 0;
  let meilleur = Infinity;
  for (let i = 0; i < etapes.length; i++) {
    const { ecartM } = projeterSurTrace(position, etapes[i].points);
    if (ecartM < meilleur - 0.5) {
      meilleur = ecartM;
      index = i;
    }
  }
  let { restantM } = projeterSurTrace(position, etapes[index].points);
  if (restantM < SEUIL_MANOEUVRE_PASSEE_M && index < etapes.length - 2) {
    index += 1;
    restantM = projeterSurTrace(position, etapes[index].points).restantM;
  }
  const prochaine = etapes[index + 1];
  if (!prochaine) {
    return { statut: 'arrive', icone: 'arrivee', instruction: messageArrivee(numeroArret, dest), suivante: null, distanceManoeuvre_m: restantM, index };
  }
  const phrase = restantM < PROCHE_MANOEUVRE_M ? prochaine.texte : `Dans ${distanceCourte(restantM)}, ${minuscule(prochaine.texte)}`;
  const apres = etapes[index + 2];
  return {
    statut: 'etapes',
    icone: prochaine.icone,
    instruction: phrase,
    suivante: apres ? `Ensuite : ${minuscule(apres.texte)}` : null,
    distanceManoeuvre_m: restantM,
    index,
  };
}
