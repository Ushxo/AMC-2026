import polygonClipping from 'polygon-clipping';

import { ORDRE_GRAVITE, type Categorie, type Coordonnees, type Etat, type Gravite, type Signalement } from '../types';

/** Rayon du disque autour de chaque signalement actif (ajustable). */
export const RAYON_ZONE_M = 30;
/** Côtés du polygone qui approche chaque disque. */
export const COTES_DISQUE = 28;
/** Seuls ces signalements créent une zone : inondation (grille bouchée, eau accumulée). */
export const CATEGORIES_ZONE: Categorie[] = ['grille_bouchee', 'eau_accumulee'];
/** Une zone n'existe que si elle réunit au moins ce nombre d'endroits distincts (une vraie fusion de disques). */
export const MIN_ENDROITS_ZONE = 2;
export const ETATS_ACTIFS: Etat[] = ['nouveau', 'pris_en_charge'];

export type PolygoneZone = { exterieur: Coordonnees[]; trous: Coordonnees[][] };

export type Zone = {
  /** Identifiant stable : le même ensemble de signalements donne toujours le même identifiant. */
  id: string;
  polygones: PolygoneZone[];
  /** Gravité MAXIMALE des signalements de la zone. */
  gravite: Gravite;
  signalement_ids: string[];
  premier_le: string;
  dernier_le: string;
};

type Anneau = [number, number][];

const M_PAR_DEGRE_LAT = 110540;

function disque(centre: Coordonnees, rayonM: number, cotes: number): Anneau {
  const dLat = rayonM / M_PAR_DEGRE_LAT;
  const dLng = rayonM / (111320 * Math.cos((centre.latitude * Math.PI) / 180));
  const anneau: Anneau = [];
  for (let i = 0; i < cotes; i++) {
    const a = (2 * Math.PI * i) / cotes;
    anneau.push([centre.longitude + dLng * Math.cos(a), centre.latitude + dLat * Math.sin(a)]);
  }
  anneau.push(anneau[0]);
  return anneau;
}

export function estSignalementDeZone(s: Pick<Signalement, 'categorie' | 'etat'>): boolean {
  return CATEGORIES_ZONE.includes(s.categorie) && ETATS_ACTIFS.includes(s.etat);
}

function dansAnneau(x: number, y: number, a: Anneau): boolean {
  let dedans = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i];
    const [xj, yj] = a[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Point dans un polygone avec trous (anneaux au format [longitude, latitude]). */
function dansPolygone(x: number, y: number, p: Anneau[]): boolean {
  if (p.length === 0 || !dansAnneau(x, y, p[0])) return false;
  for (let i = 1; i < p.length; i++) if (dansAnneau(x, y, p[i])) return false;
  return true;
}

function enCoordonnees(a: Anneau): Coordonnees[] {
  // On retire le point de fermeture répété : react-native-maps ferme le polygone lui-même.
  const ouvert = a.length > 1 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1] ? a.slice(0, -1) : a;
  return ouvert.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function hash(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/**
 * Zones de signalements : un disque autour de chaque signalement d'inondation actif ; les disques qui se
 * chevauchent fusionnent (union géométrique). Gravité = la plus haute de la zone. Sans signalement actif : aucune zone.
 */
/** Regroupe les signalements dont les disques peuvent se toucher (distance < 2 rayons) : l'union se fait par groupe, bien plus vite. */
function groupesProches(actifs: Signalement[], rayonM: number): Signalement[][] {
  const kx = 111320 * Math.cos((actifs[0].latitude * Math.PI) / 180);
  const pos = actifs.map((s) => [s.longitude * kx, s.latitude * M_PAR_DEGRE_LAT] as const);
  const seuil = 2 * rayonM * 0.98;
  const cellule = 2 * rayonM;
  const grille = new Map<string, number[]>();
  const parent = actifs.map((_, i) => i);
  const racine = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  actifs.forEach((_, i) => {
    const cx = Math.floor(pos[i][0] / cellule);
    const cy = Math.floor(pos[i][1] / cellule);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grille.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]) < seuil) parent[racine(i)] = racine(j);
        }
      }
    }
    const cle = `${cx}:${cy}`;
    grille.set(cle, [...(grille.get(cle) ?? []), i]);
  });
  const groupes = new Map<number, Signalement[]>();
  actifs.forEach((s, i) => {
    const r = racine(i);
    groupes.set(r, [...(groupes.get(r) ?? []), s]);
  });
  return [...groupes.values()];
}

/**
 * Zones de signalements : un disque autour de chaque signalement d'inondation actif ; les disques qui se
 * chevauchent fusionnent (union géométrique). Gravité = la plus haute de la zone. Sans signalement actif : aucune zone.
 */
export function calculerZones(signalements: Signalement[], rayonM: number = RAYON_ZONE_M): Zone[] {
  const actifs = signalements.filter(estSignalementDeZone);
  if (actifs.length === 0) return [];
  const zones: Zone[] = [];
  for (const groupe of groupesProches(actifs, rayonM)) {
    const disques = groupe.map((s) => [disque({ latitude: s.latitude, longitude: s.longitude }, rayonM, COTES_DISQUE)]);
    const [premier, ...autres] = disques;
    const fusion = polygonClipping.union([premier], ...autres.map((d) => [d]));
    for (const polygone of fusion) {
      const membres = groupe.filter((s) => dansPolygone(s.longitude, s.latitude, polygone as Anneau[]));
      const endroits = new Set(membres.map((s) => `${s.latitude.toFixed(6)}:${s.longitude.toFixed(6)}`));
      if (endroits.size < MIN_ENDROITS_ZONE) continue;
      const ids = membres.map((s) => s.id).sort();
      const dates = membres.map((s) => s.cree_le).sort();
      zones.push({
        id: `zone-${hash(ids.join('|'))}`,
        polygones: [
          {
            exterieur: enCoordonnees(polygone[0] as Anneau),
            trous: (polygone.slice(1) as Anneau[]).map(enCoordonnees),
          },
        ],
        gravite: membres.reduce<Gravite>((m, s) => (ORDRE_GRAVITE[s.gravite] > ORDRE_GRAVITE[m] ? s.gravite : m), 'faible'),
        signalement_ids: ids,
        premier_le: dates[0],
        dernier_le: dates[dates.length - 1],
      });
    }
  }
  // Ordre stable : gravité croissante (les plus graves dessinées en dernier), puis identifiant.
  return zones.sort((a, b) => ORDRE_GRAVITE[a.gravite] - ORDRE_GRAVITE[b.gravite] || (a.id < b.id ? -1 : 1));
}

let derniere: { cle: string; resultat: Zone[] } | null = null;

/** Même calcul, mémorisé : on ne recalcule que si la liste (identifiants, états, gravités, positions) change. */
export function calculerZonesMemo(signalements: Signalement[], rayonM: number = RAYON_ZONE_M): Zone[] {
  const cle = `${rayonM}|${signalements
    .filter(estSignalementDeZone)
    .map((s) => `${s.id}:${s.gravite}:${s.latitude}:${s.longitude}`)
    .sort()
    .join(',')}`;
  if (derniere?.cle === cle) return derniere.resultat;
  const resultat = calculerZones(signalements, rayonM);
  derniere = { cle, resultat };
  return resultat;
}

/** Zone qui contient ce point (pour le toucher de la carte). Les plus graves d'abord. */
export function zoneEn(zones: Zone[], p: Coordonnees): Zone | null {
  const ordre = [...zones].sort((a, b) => ORDRE_GRAVITE[b.gravite] - ORDRE_GRAVITE[a.gravite]);
  for (const z of ordre) {
    for (const poly of z.polygones) {
      const anneaux: Anneau[] = [poly.exterieur, ...poly.trous].map((r) => r.map((c) => [c.longitude, c.latitude] as [number, number]));
      if (dansPolygone(p.longitude, p.latitude, anneaux)) return z;
    }
  }
  return null;
}
