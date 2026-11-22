import type { Coordonnees, Endroit, Gravite } from '../types';
import type { Region } from './config';

/** Écart minimal visé entre deux repères à l'écran (points). */
export const ECART_MIN_PX = 40;
/** En dessous de cette hauteur de zone visible (degrés), les repères sont assez espacés : plus de regroupement. */
export const SEUIL_ZOOM_REGROUPEMENT = 0.004;
/** Gravité moyenne d'un groupe : faible = 1, moyenne = 2, élevée = 3 ; moins de 1,5 = faible, moins de 2,5 = moyenne, sinon élevée. */
export const SEUIL_MOYENNE = 1.5;
export const SEUIL_ELEVEE = 2.5;
const VALEUR_GRAVITE: Record<Gravite, number> = { faible: 1, moyenne: 2, elevee: 3 };
/** Taille de case de base (degrés de latitude) : les cases doublent de taille à chaque niveau, pour des identifiants stables. */
const CASE_BASE = 0.0005;
const M_PAR_DEGRE_LAT = 110540;
const M_PAR_DEGRE_LNG_EQ = 111320;

/** Un élément d'information de la carte (avis d'eau, eau accumulée, chantier, zone inondable) qui entre dans les groupes de son secteur. */
export type ItemInfo = { id: string; genre: 'ebullition' | 'coupure' | 'bande' | 'chantier' | 'zone'; position: Coordonnees };

export const estAvisEau = (i: Pick<ItemInfo, 'genre'>): boolean => i.genre === 'ebullition' || i.genre === 'coupure';

export type Groupe = {
  /** Identifiant stable : niveau de zoom + case de la grille. */
  id: string;
  /** Barycentre des endroits du groupe. */
  position: Coordonnees;
  endroits: Endroit[];
  /** Nombre d'endroits. */
  nombre: number;
  /** Gravité MOYENNE (pondérée par le nombre de signalements ouverts de chaque endroit). */
  gravite: Gravite;
  nombreEleves: number;
  /** Il y a au moins un endroit élevé mais la moyenne n'est pas rouge : on le signale par un point rouge. */
  marqueEleve: boolean;
  /** Éléments d'information absorbés par le groupe (ils ne changent ni le nombre ni la gravité moyenne). */
  infos: ItemInfo[];
  /** Nombre d'avis d'eau officiels parmi les éléments d'information absorbés. */
  nombreAvis: number;
  /** Secteur qui n'a QUE des éléments d'information : un repère de groupe neutre (bleu), `nombre` compte alors ces éléments. */
  seulementInfo: boolean;
};

export type Regroupement = { groupes: Groupe[]; isoles: Endroit[]; infosIsolees: ItemInfo[] };

export function graviteMoyenne(endroits: Pick<Endroit, 'gravite_affichee' | 'nombre'>[]): Gravite {
  let somme = 0;
  let poids = 0;
  for (const e of endroits) {
    const w = Math.max(1, e.nombre);
    somme += w * VALEUR_GRAVITE[e.gravite_affichee];
    poids += w;
  }
  const moyenne = poids > 0 ? somme / poids : 1;
  return moyenne < SEUIL_MOYENNE ? 'faible' : moyenne < SEUIL_ELEVEE ? 'moyenne' : 'elevee';
}

/** Niveau de grille (entier) pour viser ECART_MIN_PX à l'écran. */
export function niveauGrille(latitudeDelta: number, hauteurPx: number): number {
  const voulu = (latitudeDelta * ECART_MIN_PX) / Math.max(hauteurPx, 1);
  return Math.max(0, Math.ceil(Math.log2(voulu / CASE_BASE)));
}

/** Marge d'hystérésis (en niveaux) : on ne change de niveau que si le zoom dépasse nettement la limite. */
export const HYSTERESIS_NIVEAU = 0.2;

/**
 * Même niveau que `niveauGrille`, mais on garde le niveau précédent tant que le zoom reste à moins de
 * HYSTERESIS_NIVEAU de sa plage : à la limite entre deux niveaux, le regroupement n'oscille pas.
 */
export function niveauStable(precedent: number | null, latitudeDelta: number, hauteurPx: number): number {
  const brut = niveauGrille(latitudeDelta, hauteurPx);
  if (precedent === null || precedent === brut) return brut;
  const voulu = (latitudeDelta * ECART_MIN_PX) / Math.max(hauteurPx, 1);
  const exact = Math.log2(voulu / CASE_BASE); // le niveau n couvre ]n - 1 ; n]
  return exact > precedent - 1 - HYSTERESIS_NIVEAU && exact <= precedent + HYSTERESIS_NIVEAU ? precedent : brut;
}

/** Taille d'une case (degrés) : carrée au sol, donc la longitude est corrigée par le cosinus de la latitude. */
export function tailleCase(niveau: number, latitude: number): { dLat: number; dLng: number } {
  const dLat = CASE_BASE * 2 ** niveau;
  const dLng = (dLat * M_PAR_DEGRE_LAT) / (M_PAR_DEGRE_LNG_EQ * Math.cos((latitude * Math.PI) / 180));
  return { dLat, dLng };
}

export function dansRegion(p: Coordonnees, r: Region, marge = 0.2): boolean {
  const mLat = r.latitudeDelta * marge;
  const mLng = r.longitudeDelta * marge;
  return (
    Math.abs(p.latitude - r.latitude) <= r.latitudeDelta / 2 + mLat &&
    Math.abs(p.longitude - r.longitude) <= r.longitudeDelta / 2 + mLng
  );
}

/**
 * Regroupe les endroits de la zone visible par secteur : une case qui contient 2 endroits ou plus devient UN groupe
 * (placé au barycentre) ; une case à un seul endroit garde son repère ; aucun regroupement quand on est assez zoomé.
 */
export function regrouper(endroits: Endroit[], region: Region, hauteurPx: number, niveauImpose?: number, infos: ItemInfo[] = []): Regroupement {
  const visibles = endroits.filter((e) => dansRegion(e.position, region));
  const infosVisibles = infos.filter((i) => dansRegion(i.position, region));
  if (region.latitudeDelta <= SEUIL_ZOOM_REGROUPEMENT) return { groupes: [], isoles: visibles, infosIsolees: infosVisibles };
  const niveau = niveauImpose ?? niveauGrille(region.latitudeDelta, hauteurPx);
  const { dLat, dLng } = tailleCase(niveau, region.latitude);
  const cleDe = (p: Coordonnees) => `${Math.floor(p.latitude / dLat)}:${Math.floor(p.longitude / dLng)}`;
  const cases = new Map<string, { e: Endroit[]; i: ItemInfo[] }>();
  const dans = (cle: string) => {
    let c = cases.get(cle);
    if (!c) cases.set(cle, (c = { e: [], i: [] }));
    return c;
  };
  for (const e of visibles) dans(cleDe(e.position)).e.push(e);
  for (const i of infosVisibles) dans(cleDe(i.position)).i.push(i);
  const groupes: Groupe[] = [];
  const isoles: Endroit[] = [];
  const infosIsolees: ItemInfo[] = [];
  for (const [cle, { e: liste, i: elements }] of cases) {
    // Deux signalements ou plus : groupe classique, qui absorbe les éléments d'information du secteur.
    // Un seul signalement (ou aucun) : il garde son repère ; les éléments d'information font un groupe « information » à partir de deux.
    if (liste.length < 2) {
      isoles.push(...liste);
      if (elements.length < 2) {
        infosIsolees.push(...elements);
        continue;
      }
      groupes.push({
        id: `groupe-info-${niveau}-${cle}`,
        position: barycentre(elements.map((x) => x.position)),
        endroits: [],
        nombre: elements.length,
        gravite: 'faible',
        nombreEleves: 0,
        marqueEleve: false,
        infos: elements,
        nombreAvis: elements.filter(estAvisEau).length,
        seulementInfo: true,
      });
      continue;
    }
    const gravite = graviteMoyenne(liste);
    const nombreEleves = liste.filter((e) => e.gravite_affichee === 'elevee').length;
    groupes.push({
      id: `groupe-${niveau}-${cle}`,
      position: barycentre([...liste.map((x) => x.position), ...elements.map((x) => x.position)]),
      endroits: liste,
      nombre: liste.length,
      gravite,
      nombreEleves,
      marqueEleve: nombreEleves > 0 && gravite !== 'elevee',
      infos: elements,
      nombreAvis: elements.filter(estAvisEau).length,
      seulementInfo: false,
    });
  }
  return { groupes, isoles, infosIsolees };
}

function barycentre(points: Coordonnees[]): Coordonnees {
  return {
    latitude: points.reduce((t, p) => t + p.latitude, 0) / points.length,
    longitude: points.reduce((t, p) => t + p.longitude, 0) / points.length,
  };
}

/** Écart à l'écran (points) en dessous duquel deux repères se superposeraient. */
export const ECART_SUPERPOSITION_PX = 14;

/**
 * Éléments d'information isolés : un repère d'information trop proche (quelques points d'écran) d'un repère de signalement ou d'un autre
 * élément est décalé vers l'est : le signalement garde sa place (priorité), rien ne se superpose.
 */
export function decalerInfos(infos: ItemInfo[], endroits: Endroit[], region: Region, hauteurPx: number): ItemInfo[] {
  const mParPoint = (region.latitudeDelta * M_PAR_DEGRE_LAT) / Math.max(hauteurPx, 1);
  const dLngParPoint = mParPoint / (M_PAR_DEGRE_LNG_EQ * Math.cos((region.latitude * Math.PI) / 180));
  const pt = (p: Coordonnees) => ({ x: p.longitude / dLngParPoint, y: (p.latitude * M_PAR_DEGRE_LAT) / mParPoint });
  const occupes = endroits.map((e) => pt(e.position));
  const sortie: ItemInfo[] = [];
  for (const i of infos) {
    let position = i.position;
    for (let essai = 0; essai < 6; essai++) {
      const a = pt(position);
      if (!occupes.some((o) => Math.hypot(o.x - a.x, o.y - a.y) < ECART_SUPERPOSITION_PX)) break;
      position = { latitude: position.latitude, longitude: position.longitude + dLngParPoint * ECART_SUPERPOSITION_PX * (essai + 1) };
    }
    occupes.push(pt(position));
    sortie.push(position === i.position ? i : { ...i, position });
  }
  return sortie;
}

/** Sélection d'un groupe : tous, certains ou aucun de ses endroits. */
export function etatSelectionGroupe(g: Groupe, estChoisi: (cle: string) => boolean): 'tous' | 'partiel' | 'aucun' {
  const n = g.endroits.filter((e) => estChoisi(e.cle)).length;
  return n === 0 ? 'aucun' : n === g.endroits.length ? 'tous' : 'partiel';
}

/** « Secteur : 12 endroits signalés, gravité moyenne : moyenne, dont 3 élevés, 2 avis d'eau. Toucher pour zoomer » */
export function libelleGroupe(g: Groupe, libelleGravite: (x: Gravite) => string): string {
  if (g.seulementInfo) {
    const autres = g.infos.length - g.nombreAvis;
    const parts = [g.nombreAvis > 0 ? `${g.nombreAvis} ${g.nombreAvis > 1 ? "avis d'eau" : "avis d'eau"}` : '', autres > 0 ? `${autres} ${autres > 1 ? 'autres informations' : 'autre information'}` : ''].filter(Boolean);
    return `Secteur : ${g.infos.length} éléments d'information (${parts.join(', ')}). Toucher pour zoomer`;
  }
  const eleves = g.nombreEleves > 0 ? `, dont ${g.nombreEleves} ${g.nombreEleves > 1 ? 'élevés' : 'élevé'}` : '';
  const avis = g.nombreAvis > 0 ? `, ${g.nombreAvis} ${g.nombreAvis > 1 ? "avis d'eau" : "avis d'eau"}` : '';
  const autres = g.infos.length - g.nombreAvis;
  const reste = autres > 0 ? `, ${autres} ${autres > 1 ? 'autres informations' : 'autre information'}` : '';
  return `Secteur : ${g.nombre} endroits signalés, gravité moyenne : ${libelleGravite(g.gravite).toLowerCase()}${eleves}${avis}${reste}. Toucher pour zoomer`;
}
