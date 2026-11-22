import { ORDRE_GRAVITE, type Categorie, type Coordonnees, type Endroit, type Etat, type Gravite } from '../types';
import { clesDeZone } from './selection';
import { adressePlusProche } from './recherche';
import type { Zone } from './zones';

/** Filtre d'état de la liste du superviseur : « À traiter » (nouveau et pris en charge) par défaut, un état précis, ou tous. */
export type FiltreEtat = 'a_traiter' | 'nouveau' | 'pris_en_charge' | 'regle' | 'rejete' | 'tous';
export const FILTRES_ETAT: FiltreEtat[] = ['a_traiter', 'nouveau', 'pris_en_charge', 'regle', 'rejete', 'tous'];
export const LIBELLES_FILTRE_ETAT: Record<FiltreEtat, string> = {
  a_traiter: 'À traiter',
  nouveau: 'Nouveaux',
  pris_en_charge: 'Pris en charge',
  regle: 'Réglés',
  rejete: 'Rejetés',
  tous: 'Tous',
};
/** Titre de la page selon le filtre d'état. */
export const TITRES_FILTRE_ETAT: Record<FiltreEtat, string> = {
  a_traiter: 'À planifier',
  nouveau: 'Nouveaux',
  pris_en_charge: 'Pris en charge',
  regle: 'Réglés',
  rejete: 'Rejetés',
  tous: 'Tous les endroits',
};
const ETATS_DU_FILTRE: Record<FiltreEtat, Etat[] | null> = {
  a_traiter: ['nouveau', 'pris_en_charge'],
  nouveau: ['nouveau'],
  pris_en_charge: ['pris_en_charge'],
  regle: ['regle'],
  rejete: ['rejete'],
  tous: null,
};
/** Le calcul d'optimisation ne porte que sur des endroits à traiter. */
export function filtreCalculable(etat: FiltreEtat): boolean {
  return etat === 'a_traiter' || etat === 'nouveau' || etat === 'pris_en_charge';
}

export type FiltresInterventions = { zoneId: string | null; categorie: Categorie | null; gravite: Gravite | null; etat: FiltreEtat };
export const AUCUN_FILTRE: FiltresInterventions = { zoneId: null, categorie: null, gravite: null, etat: 'a_traiter' };

export type Intervention = {
  endroit: Endroit;
  categorie: Categorie;
  signaleeLe: string;
  gravite: Gravite;
  /** Nombre de signalements de l'endroit qui correspondent aux filtres (état et type de problème). */
  nombre?: number;
  /** État dominant de l'endroit. */
  etat?: Etat;
};

function ouverts(e: Endroit) {
  return e.signalements.filter((s) => s.etat === 'nouveau' || s.etat === 'pris_en_charge');
}

/** Le problème montré pour un endroit : celui du signalement ouvert le plus récent. */
export function interventionDe(e: Endroit): Intervention | null {
  const liste = ouverts(e);
  if (liste.length === 0) return null;
  const recent = [...liste].sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0];
  return { endroit: e, categorie: recent.categorie, signaleeLe: recent.cree_le, gravite: e.gravite_affichee };
}

/**
 * La liste du superviseur : les endroits qui ont au moins un signalement dans l'état demandé (à traiter par défaut) et du type demandé,
 * filtrés par secteur et par importance, du plus important au moins important (à égalité, le plus ancien d'abord).
 */
export function interventionsAPlanifier(endroits: Endroit[], zones: Zone[], filtres: FiltresInterventions): Intervention[] {
  const zone = filtres.zoneId ? zones.find((z) => z.id === filtres.zoneId) : undefined;
  const clesZone = zone ? new Set(clesDeZone(zone, endroits)) : null;
  const etats = ETATS_DU_FILTRE[filtres.etat ?? 'a_traiter'];
  const liste: Intervention[] = [];
  for (const e of endroits) {
    const bons = e.signalements.filter((s) => (!etats || etats.includes(s.etat)) && (!filtres.categorie || s.categorie === filtres.categorie));
    if (bons.length === 0) continue;
    if (clesZone && !clesZone.has(e.cle)) continue;
    if (filtres.gravite && e.gravite_affichee !== filtres.gravite) continue;
    const recent = [...bons].sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0];
    liste.push({ endroit: e, categorie: filtres.categorie ?? recent.categorie, signaleeLe: recent.cree_le, gravite: e.gravite_affichee, nombre: bons.length, etat: e.etat_dominant });
  }
  return liste.sort((a, b) => ORDRE_GRAVITE[b.gravite] - ORDRE_GRAVITE[a.gravite] || a.signaleeLe.localeCompare(b.signaleeLe));
}

/**
 * Les endroits décochés se mémorisent par leurs clés EXCLUES (pas par les incluses) : un endroit arrivé en direct, ou qu'un filtre
 * fait réapparaître, est inclus par défaut.
 */
export type Exclues = ReadonlySet<string>;

/** Les clés de la liste affichée qui partent dans le calcul : celles qui ne sont pas exclues. */
export function clesIncluses(liste: Intervention[], exclues: Exclues): string[] {
  return liste.filter((i) => !exclues.has(i.endroit.cle)).map((i) => i.endroit.cle);
}

export function basculerExclue(exclues: Exclues, cle: string): Set<string> {
  const suite = new Set(exclues);
  if (suite.has(cle)) suite.delete(cle);
  else suite.add(cle);
  return suite;
}

/** « Tout cocher » : retire de la mémoire les clés de la liste affichée ; « Tout décocher » : les y ajoute. Les autres clés restent. */
export function toutCocher(liste: Intervention[], exclues: Exclues): Set<string> {
  const suite = new Set(exclues);
  for (const i of liste) suite.delete(i.endroit.cle);
  return suite;
}
export function toutDecocher(liste: Intervention[], exclues: Exclues): Set<string> {
  const suite = new Set(exclues);
  for (const i of liste) suite.add(i.endroit.cle);
  return suite;
}

export function clesDesInterventions(liste: Intervention[]): string[] {
  return liste.map((i) => i.endroit.cle);
}

/** « Près de 900 place X » grâce à l'index d'adresses local (marche hors ligne), sinon les coordonnées. */
export function lieuDeEndroit(position: Coordonnees, adresses: Parameters<typeof adressePlusProche>[1]): string {
  const p = adressePlusProche(position, adresses);
  return p ? `Près de ${p.libelle}` : `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`;
}

/** Durée d'un trajet en français : « 18 min », « 1 h 05 ». */
export function formaterDuree(secondes: number): string {
  const min = Math.max(1, Math.round(secondes / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
