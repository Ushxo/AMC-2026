import type { Coordonnees, Signalement } from '../types';
import type { EntreeAdresse } from './officiel';
import { adressePlusProche, normaliser } from './recherche';
import { chargerTroncons, longueurPolyligneM, sousPolyligne, tronconsProches, type DonneesTroncons } from './troncons';

/** Le tronçon doit être à cette distance au plus du signalement. */
export const RAYON_TRONCON_M = 60;
/** Demi-longueur de la bande autour du point projeté (bande de 90 m). */
export const DEMI_LONGUEUR_M = 45;
/** Deux parties du même tronçon plus proches que cela n'en font qu'une. */
export const ECART_FUSION_M = 5;

export type BandeEau = {
  /** Un identifiant par tronçon : plusieurs signalements sur le même tronçon donnent une seule bande. */
  id: string;
  /** Nom de la rue, sans numéro civique. */
  rue: string;
  /** Les parties de tracé à dessiner : elles suivent les points réels du tronçon (plus de segment deviné). */
  traces: Coordonnees[][];
  signalement_ids: string[];
};

/** « 1244-1256 rue Barré » devient « rue Barré ». */
export function nomDeRue(libelle: string): string {
  return libelle.replace(/^\s*\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?\s+/, '').trim();
}

type Intervalle = [number, number];

function fusionner(liste: Intervalle[]): Intervalle[] {
  const tri = [...liste].sort((a, b) => a[0] - b[0]);
  const out: Intervalle[] = [];
  for (const iv of tri) {
    const dernier = out[out.length - 1];
    if (dernier && iv[0] <= dernier[1] + ECART_FUSION_M) dernier[1] = Math.max(dernier[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

/**
 * Bandes d'inondation : pour chaque signalement d'eau accumulée actif, le tronçon de rue le plus proche (à 60 m au plus, de préférence
 * celui de la rue de l'adresse la plus proche), découpé à 45 m de part et d'autre du point projeté (ou entier s'il fait moins de 90 m).
 * Plusieurs signalements sur le même tronçon : une seule bande. Rien trouvé : rien n'est dessiné.
 */
export function bandesInondation(signalements: Signalement[], adresses: EntreeAdresse[], donnees: DonneesTroncons | null = chargerTroncons()): BandeEau[] {
  if (!donnees) return [];
  const actifs = signalements.filter((s) => s.categorie === 'eau_accumulee' && (s.etat === 'nouveau' || s.etat === 'pris_en_charge'));
  const parTroncon = new Map<number, { libelle: string; points: [number, number][]; longueur: number; intervalles: Intervalle[]; ids: string[] }>();
  for (const s of actifs) {
    const p = { latitude: s.latitude, longitude: s.longitude };
    const proches = tronconsProches(p, RAYON_TRONCON_M, donnees);
    if (proches.length === 0) continue;
    const adresse = adressePlusProche(p, adresses, RAYON_TRONCON_M);
    const cle = adresse ? normaliser(nomDeRue(adresse.libelle)) : null;
    const choisi = (cle ? proches.find((t) => t.troncon.nom === cle) : undefined) ?? proches[0];
    const t = choisi.troncon;
    const entree = parTroncon.get(t.id) ?? { libelle: t.libelle, points: t.points, longueur: longueurPolyligneM(t.points), intervalles: [], ids: [] };
    entree.intervalles.push(entree.longueur <= 2 * DEMI_LONGUEUR_M ? [0, entree.longueur] : [Math.max(0, choisi.abscisseM - DEMI_LONGUEUR_M), Math.min(entree.longueur, choisi.abscisseM + DEMI_LONGUEUR_M)]);
    entree.ids.push(s.id);
    parTroncon.set(t.id, entree);
  }
  return [...parTroncon.entries()].map(([id, e]) => ({
    id: `bande-${id}`,
    rue: e.libelle,
    traces: fusionner(e.intervalles)
      .map(([a, b]) => sousPolyligne(e.points, a, b))
      .filter((tr) => tr.length >= 2),
    signalement_ids: e.ids,
  }));
}

export function libelleBande(b: Pick<BandeEau, 'rue'>): string {
  return `Eau accumulée sur ${b.rue}`;
}
