import type { Coordonnees } from '../types';

/** Un tronçon de rue du réseau routier (Géobase, Ville de Montréal, CC BY 4.0). */
export type Troncon = { id: number; nom: string; libelle: string; points: [number, number][] };

export type DonneesTroncons = {
  grille: { pas: number; latitudeMin: number; longitudeMin: number };
  troncons: Troncon[];
  cases: Record<string, number[]>;
};

let cache: DonneesTroncons | null | undefined;
let parId: Map<number, Troncon> | null = null;

/** Le réseau routier, chargé au premier besoin seulement (le fichier pèse environ 400 Ko : l'ouverture de l'app n'attend pas). */
export function chargerTroncons(): DonneesTroncons | null {
  if (cache !== undefined) return cache;
  try {
    const brut = require('../donnees/troncons.json');
    cache = brut && Array.isArray(brut.troncons) && brut.grille ? (brut as DonneesTroncons) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function tronconParId(id: number, donnees: DonneesTroncons | null = chargerTroncons()): Troncon | undefined {
  if (!donnees) return undefined;
  if (donnees === cache) {
    parId ??= new Map(donnees.troncons.map((t) => [t.id, t]));
    return parId.get(id);
  }
  return donnees.troncons.find((t) => t.id === id);
}

const M_LAT = 110574;

type Local = { x: number; y: number };

/** Projection locale en mètres autour d'une latitude de référence. */
function versLocal(lat0: number, lng: number, lat: number): Local {
  return { x: lng * Math.cos((lat0 * Math.PI) / 180) * 111320, y: lat * M_LAT };
}

export type Projection = { distanceM: number; /** Abscisse du point projeté le long de la polyligne, en mètres depuis son début. */ abscisseM: number };

/** Distance du point à la polyligne, et où il se projette le long d'elle. */
export function projeterSurPolyligne(p: Coordonnees, points: [number, number][]): Projection {
  const o = versLocal(p.latitude, p.longitude, p.latitude);
  let meilleure: Projection = { distanceM: Infinity, abscisseM: 0 };
  let cumul = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = versLocal(p.latitude, points[i][0], points[i][1]);
    const b = versLocal(p.latitude, points[i + 1][0], points[i + 1][1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * dy) / l2));
    const d = Math.hypot(a.x + t * dx - o.x, a.y + t * dy - o.y);
    const longueur = Math.sqrt(l2);
    if (d < meilleure.distanceM) meilleure = { distanceM: d, abscisseM: cumul + t * longueur };
    cumul += longueur;
  }
  return meilleure;
}

/** Longueur de la polyligne en mètres. */
export function longueurPolyligneM(points: [number, number][]): number {
  if (points.length < 2) return 0;
  const lat0 = points[0][1];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = versLocal(lat0, points[i][0], points[i][1]);
    const b = versLocal(lat0, points[i + 1][0], points[i + 1][1]);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** La partie de la polyligne entre deux abscisses (en mètres), en suivant ses points réels. */
export function sousPolyligne(points: [number, number][], debutM: number, finM: number): Coordonnees[] {
  const out: Coordonnees[] = [];
  if (points.length < 2 || finM <= debutM) return out;
  const lat0 = points[0][1];
  let cumul = 0;
  const pt = (x: number, y: number): Coordonnees => ({ latitude: y, longitude: x });
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const a = versLocal(lat0, x1, y1);
    const b = versLocal(lat0, x2, y2);
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    const s0 = cumul;
    const s1 = cumul + l;
    if (s1 >= debutM && s0 <= finM && l > 0) {
      const t0 = Math.max(0, (debutM - s0) / l);
      const t1 = Math.min(1, (finM - s0) / l);
      if (out.length === 0) out.push(pt(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0));
      out.push(pt(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1));
    }
    cumul = s1;
  }
  return out;
}

export type TronconProche = { troncon: Troncon; distanceM: number; abscisseM: number };

/** Les tronçons à `rayonM` mètres au plus du point, le plus proche en premier (grille de cases : 9 cases suffisent jusqu'à 150 m). */
export function tronconsProches(p: Coordonnees, rayonM: number, donnees: DonneesTroncons | null = chargerTroncons()): TronconProche[] {
  if (!donnees) return [];
  const { pas, latitudeMin, longitudeMin } = donnees.grille;
  const i = Math.floor((p.latitude - latitudeMin) / pas);
  const j = Math.floor((p.longitude - longitudeMin) / pas);
  const vus = new Set<number>();
  const trouves: TronconProche[] = [];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      for (const idx of donnees.cases[`${i + di}_${j + dj}`] ?? []) {
        if (vus.has(idx)) continue;
        vus.add(idx);
        const troncon = donnees.troncons[idx];
        if (!troncon) continue;
        const pr = projeterSurPolyligne(p, troncon.points);
        if (pr.distanceM <= rayonM) trouves.push({ troncon, distanceM: pr.distanceM, abscisseM: pr.abscisseM });
      }
    }
  }
  return trouves.sort((a, b) => a.distanceM - b.distanceM);
}
