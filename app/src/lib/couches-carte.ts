import type { AvisEau, Coordonnees, CoucheAvisEau, CoucheChantiers, CoucheZonesInondables, TypeAvisEau } from '../types';
import { distanceM, pointDansGeometrie } from './geo';
import { formaterDate } from './format';

/** Les couches que le citoyen peut afficher ou masquer sur la carte. */
export type CoucheCarte = 'signalements' | 'eauAccumulee' | 'ebullition' | 'coupures' | 'regards' | 'chantiers' | 'zonesInondables';

export const COUCHES_CARTE: CoucheCarte[] = ['signalements', 'eauAccumulee', 'ebullition', 'coupures', 'regards', 'chantiers', 'zonesInondables'];

export const LIBELLES_COUCHE: Record<CoucheCarte, string> = {
  signalements: 'Signalements des citoyens',
  eauAccumulee: 'Eau accumulée sur la rue (bande bleue)',
  ebullition: "Avis d'ébullition",
  coupures: "Coupures d'eau",
  regards: "Regards d'égout",
  chantiers: 'Chantiers',
  zonesInondables: 'Zones inondables (crues 2022)',
};

export type EtatCouches = Record<CoucheCarte, boolean>;

/** Au départ : tout ce qui concerne l'eau et les signalements ; les chantiers et les zones de crue sont à la demande. */
export const COUCHES_PAR_DEFAUT: EtatCouches = {
  signalements: true,
  eauAccumulee: true,
  ebullition: true,
  coupures: true,
  regards: true,
  chantiers: false,
  zonesInondables: false,
};

export function basculerCouche(etat: EtatCouches, c: CoucheCarte): EtatCouches {
  return { ...etat, [c]: !etat[c] };
}

export const LIBELLES_TYPE_AVIS: Record<TypeAvisEau, string> = { ebullition: "Avis d'ébullition", coupure: "Coupure d'eau" };

/** Avis à dessiner selon les couches choisies (ébullition et coupures se masquent séparément). */
export function avisVisibles(avis: CoucheAvisEau, etat: EtatCouches): AvisEau[] {
  return avis.features.filter((f) => (f.properties.type === 'ebullition' ? etat.ebullition : etat.coupures));
}

export type VerificationAvis = { sous: boolean; avis: AvisEau[]; message: string };

/** Le point (adresse cherchée ou position) est-il dans un avis d'ébullition ou une coupure en cours ? Toujours sur TOUS les avis, couche masquée ou non. */
export function verifierAvis(point: Coordonnees, avis: CoucheAvisEau, source: 'adresse' | 'position'): VerificationAvis {
  const trouves = avis.features.filter((f) => pointDansGeometrie(point, f.geometry));
  const sujet = source === 'adresse' ? 'Cette adresse' : 'Votre position';
  if (trouves.length === 0) return { sous: false, avis: [], message: `${sujet} n'est sous aucun avis d'ébullition ni coupure d'eau en cours.` };
  const types = [...new Set(trouves.map((f) => f.properties.type))];
  const quoi = types.map((t) => (t === 'ebullition' ? "d'ébullition" : "de coupure d'eau")).join(' et ');
  return { sous: true, avis: trouves, message: `${sujet} est sous un avis ${quoi}.` };
}

export type ElementCarte = {
  /** Identifiant stable, pour la clé d'affichage. */
  id: string;
  type: string;
  titre: string;
  lignes: { etiquette: string; valeur: string }[];
};

const LIBELLES_GRAVITE_FICHE = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' } as const;

function jour(iso: string | null | undefined): string {
  return iso ? formaterDate(iso).replace(/,.*$/, '') : '';
}

/** Fiche d'un avis : type, origine, importance, état (en cours), dates, adresse et source. */
export function ficheAvis(a: AvisEau): ElementCarte {
  const p = a.properties;
  const lignes = [
    { etiquette: 'Type', valeur: LIBELLES_TYPE_AVIS[p.type] },
    { etiquette: 'Origine', valeur: 'Officiel (Ville de Montréal)' },
    { etiquette: 'Gravité', valeur: LIBELLES_GRAVITE_FICHE[p.gravite] },
    { etiquette: 'État', valeur: p.fin ? `En cours jusqu'au ${jour(p.fin)}` : 'En cours' },
    { etiquette: 'Début', valeur: jour(p.debut) },
  ];
  if (p.adresse) lignes.push({ etiquette: 'Adresse', valeur: p.adresse });
  lignes.push({ etiquette: 'Source', valeur: 'Données ouvertes de la Ville de Montréal, CC BY 4.0' });
  return { id: `avis-${p.id}`, type: LIBELLES_TYPE_AVIS[p.type], titre: p.titre, lignes };
}

const RAYON_CHANTIER_M = 40;

/** Chantier touché sur la carte (à moins de 40 m), le plus proche. */
export function chantierEn(chantiers: CoucheChantiers, p: Coordonnees, toleranceM = 0): CoucheChantiers['features'][number] | null {
  let meilleur: { d: number; f: CoucheChantiers['features'][number] } | null = null;
  for (const f of chantiers.features) {
    if (!f.geometry) continue;
    const [longitude, latitude] = f.geometry.coordinates;
    const d = distanceM(p, { latitude, longitude });
    if (d <= RAYON_CHANTIER_M + toleranceM && (!meilleur || d < meilleur.d)) meilleur = { d, f };
  }
  return meilleur?.f ?? null;
}

export function ficheChantier(f: CoucheChantiers['features'][number]): ElementCarte {
  const p = f.properties;
  const lignes = [
    { etiquette: 'Type', valeur: 'Chantier' },
    { etiquette: 'Origine', valeur: 'Officiel (Ville de Montréal)' },
    { etiquette: 'Gravité', valeur: LIBELLES_GRAVITE_FICHE[p.gravite] },
  ];
  if (p.entreprise) lignes.push({ etiquette: 'Entreprise', valeur: p.entreprise });
  if (p.debut) lignes.push({ etiquette: 'Début', valeur: jour(p.debut) });
  if (p.fin) lignes.push({ etiquette: 'Fin prévue', valeur: jour(p.fin) });
  lignes.push({ etiquette: 'Source', valeur: 'Données ouvertes de la Ville de Montréal, CC BY 4.0' });
  return { id: `chantier-${p.id}`, type: 'Chantier', titre: 'Chantier', lignes };
}

/** Zone inondable touchée sur la carte. */
export function zoneInondableEn(zones: CoucheZonesInondables, p: Coordonnees): CoucheZonesInondables['features'][number] | null {
  return zones.features.find((f) => pointDansGeometrie(p, f.geometry)) ?? null;
}

export function ficheZoneInondable(f: CoucheZonesInondables['features'][number]): ElementCarte {
  const p = f.properties;
  return {
    id: `zone-${p.id}`,
    type: 'Zone inondable',
    titre: 'Zone inondable',
    lignes: [
      { etiquette: 'Type', valeur: 'Zone inondable' },
      { etiquette: 'Origine', valeur: 'Officiel (Ville de Montréal)' },
      { etiquette: 'Gravité', valeur: LIBELLES_GRAVITE_FICHE[p.gravite] },
      { etiquette: 'Source', valeur: p.source },
    ],
  };
}

// --- Toucher de la carte : l'élément officiel touché, n'importe où dans son tracé ---

type Geom = AvisEau['geometry'];
type PolygoneCoords = number[][][];

function polygonesDe(g: Geom | CoucheZonesInondables['features'][number]['geometry']): PolygoneCoords[] {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates as PolygoneCoords];
  if (g.type === 'MultiPolygon') return g.coordinates as PolygoneCoords[];
  return [];
}

/** Aire approximative d'un polygone en m² (plan local autour de son premier point), pour choisir le plus petit quand ils se chevauchent. */
export function aireM2(g: Geom | CoucheZonesInondables['features'][number]['geometry']): number {
  let total = 0;
  for (const poly of polygonesDe(g)) {
    const [ext, ...trous] = poly;
    if (!ext || ext.length < 3) continue;
    const [lng0, lat0] = ext[0];
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const aire = (anneau: number[][]) => {
      let a = 0;
      for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
        a += ((anneau[j][0] - lng0) * kx) * ((anneau[i][1] - lat0) * 110540) - ((anneau[i][0] - lng0) * kx) * ((anneau[j][1] - lat0) * 110540);
      }
      return Math.abs(a) / 2;
    };
    total += aire(ext) - trous.reduce((t, h) => t + aire(h), 0);
  }
  return total;
}

/** Distance en mètres du point au contour le plus proche du polygone (0 s'il est dedans). */
export function distanceAuTracerM(p: Coordonnees, g: Geom | CoucheZonesInondables['features'][number]['geometry']): number {
  if (pointDansGeometrie(p, g as never)) return 0;
  const kx = 111320 * Math.cos((p.latitude * Math.PI) / 180);
  let meilleure = Infinity;
  for (const poly of polygonesDe(g)) {
    for (const anneau of poly) {
      for (let i = 0; i < anneau.length - 1; i++) {
        const ax = (anneau[i][0] - p.longitude) * kx;
        const ay = (anneau[i][1] - p.latitude) * 110540;
        const bx = (anneau[i + 1][0] - p.longitude) * kx;
        const by = (anneau[i + 1][1] - p.latitude) * 110540;
        const dx = bx - ax;
        const dy = by - ay;
        const l2 = dx * dx + dy * dy;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
        meilleure = Math.min(meilleure, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return meilleure;
}

/** Tolérance de toucher en mètres : environ 14 points d'écran, selon le zoom de la carte (au moins 4 m, au plus 80 m). */
export function toleranceToucherM(latitudeDelta: number | undefined): number {
  if (!latitudeDelta || !Number.isFinite(latitudeDelta)) return 15;
  return Math.max(4, Math.min(80, (latitudeDelta * 110540 * 14) / 800));
}

export type ElementTouche = { element: ElementCarte; aire: number };

/**
 * L'élément officiel touché : un avis, une zone inondable (si leur couche est visible) ou un chantier.
 * Touche valable dans le tracé ou à moins de `toleranceM` du contour ; quand plusieurs se chevauchent, le plus petit gagne.
 */
export function elementTouche(
  p: Coordonnees,
  contenu: { avis: AvisEau[]; chantiers: CoucheChantiers | null; zones: CoucheZonesInondables | null },
  toleranceM: number,
): ElementCarte | null {
  const candidats: { aire: number; fiche: () => ElementCarte }[] = [];
  for (const a of contenu.avis) {
    if (a.geometry?.type === 'Point') {
      const [longitude, latitude] = a.geometry.coordinates;
      if (distanceM(p, { latitude, longitude }) <= RAYON_AVIS_TOUCHE_M + toleranceM) candidats.push({ aire: Math.PI * RAYON_AVIS_TOUCHE_M ** 2, fiche: () => ficheAvis(a) });
    } else if (a.geometry && distanceAuTracerM(p, a.geometry) <= toleranceM) {
      candidats.push({ aire: aireM2(a.geometry), fiche: () => ficheAvis(a) });
    }
  }
  if (contenu.chantiers) {
    const ch = chantierEn(contenu.chantiers, p, toleranceM);
    if (ch) candidats.push({ aire: 0, fiche: () => ficheChantier(ch) });
  }
  if (contenu.zones) {
    for (const z of contenu.zones.features) {
      if (distanceAuTracerM(p, z.geometry) <= toleranceM) candidats.push({ aire: aireM2(z.geometry), fiche: () => ficheZoneInondable(z) });
    }
  }
  if (candidats.length === 0) return null;
  return candidats.sort((a, b) => a.aire - b.aire)[0].fiche();
}

const RAYON_AVIS_TOUCHE_M = 150;
