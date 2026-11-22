import { tracesAvis } from './avis-troncons';
import type { BandeEau } from './inondation';
import { ficheAvis, ficheChantier, ficheZoneInondable, type ElementCarte } from './couches-carte';
import type { AvisEau, CoucheChantiers, CoucheZonesInondables, Coordonnees } from '../types';

/** Les genres d'éléments d'information qui reçoivent un petit repère touchable au milieu de leur dessin. */
export type GenreInfo = 'ebullition' | 'coupure' | 'bande' | 'chantier' | 'zone';

export type RepereInfo = {
  id: string;
  genre: GenreInfo;
  position: Coordonnees;
  /** Lu par le lecteur d'écran : « Avis d'ébullition, rue X ». */
  libelle: string;
  fiche: ElementCarte;
};

const M_LAT = 110540;

function metres(a: Coordonnees, b: Coordonnees): number {
  const dy = (a.latitude - b.latitude) * M_LAT;
  const dx = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** Point au milieu (en longueur) d'une ligne. */
export function milieuTrace(points: Coordonnees[]): Coordonnees | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += metres(points[i - 1], points[i]);
  let reste = total / 2;
  for (let i = 1; i < points.length; i++) {
    const d = metres(points[i - 1], points[i]);
    if (d >= reste && d > 0) {
      const t = reste / d;
      return {
        latitude: points[i - 1].latitude + (points[i].latitude - points[i - 1].latitude) * t,
        longitude: points[i - 1].longitude + (points[i].longitude - points[i - 1].longitude) * t,
      };
    }
    reste -= d;
  }
  return points[points.length - 1];
}

function dedans(p: Coordonnees, anneau: Coordonnees[]): boolean {
  let in_ = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const a = anneau[i];
    const b = anneau[j];
    if (a.latitude > p.latitude !== b.latitude > p.latitude && p.longitude < ((b.longitude - a.longitude) * (p.latitude - a.latitude)) / (b.latitude - a.latitude) + a.longitude) in_ = !in_;
  }
  return in_;
}

/** Centre visuel d'un secteur : son centre de gravité s'il est dedans, sinon le milieu de sa boîte, sinon le point intérieur le plus proche. */
export function centreSecteur(anneau: Coordonnees[]): Coordonnees | null {
  const pts = anneau.length > 1 && anneau[0].latitude === anneau[anneau.length - 1].latitude && anneau[0].longitude === anneau[anneau.length - 1].longitude ? anneau.slice(0, -1) : anneau;
  if (pts.length === 0) return null;
  let aire = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = a.longitude * b.latitude - b.longitude * a.latitude;
    aire += f;
    cx += (a.longitude + b.longitude) * f;
    cy += (a.latitude + b.latitude) * f;
  }
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const boite = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const gravite = Math.abs(aire) > 1e-14 ? { latitude: cy / (3 * aire), longitude: cx / (3 * aire) } : boite;
  if (dedans(gravite, pts)) return gravite;
  if (dedans(boite, pts)) return boite;
  // Forme en croissant : on cherche un sommet-milieu à l'intérieur (milieu du sommet le plus éloigné de la boîte vers le centre de gravité).
  for (const p of pts) {
    const m = { latitude: (p.latitude + gravite.latitude) / 2, longitude: (p.longitude + gravite.longitude) / 2 };
    if (dedans(m, pts)) return m;
  }
  return pts[0];
}

/** Fiche d'une bande d'eau accumulée (signalements de citoyens, pas un avis officiel). */
export function ficheBande(b: BandeEau): ElementCarte {
  return {
    id: b.id,
    type: 'Eau accumulée signalée',
    titre: b.rue,
    lignes: [
      { etiquette: 'Signalements de citoyens', valeur: String(b.signalement_ids.length) },
      { etiquette: 'Source', valeur: 'Signalements des citoyens (pas un avis officiel)' },
    ],
  };
}

const LIBELLE_AVIS = { ebullition: "Avis d'ébullition", coupure: "Coupure d'eau" } as const;

/** Un nom de lieu pour le lecteur d'écran, tiré du titre de l'avis (après le dernier tiret) ; le titre entier sinon. */
function lieuDuTitre(titre: string): string {
  const morceaux = titre.split(/\s[-–]\s|\s–\s/).map((t) => t.trim()).filter(Boolean);
  return morceaux.length > 1 ? morceaux[morceaux.length - 1] : titre;
}

export type EntreeRepereInfo = {
  avis: AvisEau[];
  bandes: BandeEau[];
  chantiers: CoucheChantiers['features'] | null;
  zones: CoucheZonesInondables['features'] | null;
};

/** Les repères d'information à poser : avis (milieu du tracé ou centre du secteur), bandes d'eau, chantiers et zones inondables affichés. */
export function reperesInfo(e: EntreeRepereInfo): RepereInfo[] {
  const sortie: RepereInfo[] = [];
  for (const a of e.avis) {
    const traces = tracesAvis(a);
    let position: Coordonnees | null = null;
    if (traces && traces.length > 0) {
      const plus = [...traces].sort((x, y) => y.length - x.length)[0];
      position = milieuTrace(plus);
    } else if (a.geometry?.type === 'Point') {
      position = { latitude: a.geometry.coordinates[1], longitude: a.geometry.coordinates[0] };
    } else if (a.geometry) {
      const poly = a.geometry.type === 'Polygon' ? a.geometry.coordinates[0] : a.geometry.coordinates[0]?.[0];
      position = poly ? centreSecteur(poly.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))) : null;
    }
    if (!position) continue;
    sortie.push({
      id: `info-avis-${a.properties.id}`,
      genre: a.properties.type,
      position,
      libelle: `${LIBELLE_AVIS[a.properties.type]}, ${lieuDuTitre(a.properties.titre)}`,
      fiche: ficheAvis(a),
    });
  }
  for (const b of e.bandes) {
    const plus = [...b.traces].sort((x, y) => y.length - x.length)[0];
    const position = plus ? milieuTrace(plus) : null;
    if (!position) continue;
    sortie.push({ id: `info-${b.id}`, genre: 'bande', position, libelle: `Eau accumulée signalée, ${b.rue}`, fiche: ficheBande(b) });
  }
  for (const f of e.chantiers ?? []) {
    if (!f.geometry) continue;
    const fiche = ficheChantier(f);
    sortie.push({
      id: `info-ch-${f.properties.id}`,
      genre: 'chantier',
      position: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
      libelle: `Chantier, ${fiche.titre}`,
      fiche,
    });
  }
  for (const f of e.zones ?? []) {
    const poly = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0]?.[0];
    const position = poly ? centreSecteur(poly.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))) : null;
    if (!position) continue;
    const fiche = ficheZoneInondable(f);
    sortie.push({ id: `info-zi-${f.properties.id}`, genre: 'zone', position, libelle: `Zone inondable, ${fiche.titre}`, fiche });
  }
  return sortie;
}

/**
 * Garde contre les doubles toucher : un seul élément s'ouvre par toucher (le repère, le tracé et la carte peuvent répondre ensemble),
 * et la carte ne répond plus pendant `delaiMs` après un toucher d'élément (ni la fiche d'un avis, ni la feuille « Quel problème ? » en plus).
 */
export function creerGardeToucher(delaiMs = 300, maintenant: () => number = Date.now) {
  let dernier = -Infinity;
  return {
    /** Vrai (et on note le toucher) si aucun élément n'a répondu dans le délai. */
    prendre(): boolean {
      const t = maintenant();
      if (t - dernier < delaiMs) return false;
      dernier = t;
      return true;
    },
    /** Note qu'un élément a répondu (par exemple un repère de signalement qui ouvre déjà autre chose). */
    marquer(): void {
      dernier = maintenant();
    },
    /** Vrai si un élément vient de répondre : le toucher de carte est alors ignoré. */
    recent(): boolean {
      return maintenant() - dernier < delaiMs;
    },
  };
}
