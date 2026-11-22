import { ORDRE_GRAVITE, type Categorie, type Coordonnees, type Endroit, type Gravite } from '../types';
import { endroitsOuverts, clesDeZone } from './selection';
import { adressePlusProche } from './recherche';
import type { Zone } from './zones';

export type FiltresInterventions = { zoneId: string | null; categorie: Categorie | null; gravite: Gravite | null };
export const AUCUN_FILTRE: FiltresInterventions = { zoneId: null, categorie: null, gravite: null };

export type Intervention = { endroit: Endroit; categorie: Categorie; signaleeLe: string; gravite: Gravite };

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

/** Interventions à planifier : endroits ouverts, filtrés, du plus important au moins important (à égalité, la plus ancienne d'abord). */
export function interventionsAPlanifier(endroits: Endroit[], zones: Zone[], filtres: FiltresInterventions): Intervention[] {
  const zone = filtres.zoneId ? zones.find((z) => z.id === filtres.zoneId) : undefined;
  const clesZone = zone ? new Set(clesDeZone(zone, endroits)) : null;
  const liste: Intervention[] = [];
  for (const e of endroitsOuverts(endroits)) {
    const i = interventionDe(e);
    if (!i) continue;
    if (clesZone && !clesZone.has(e.cle)) continue;
    if (filtres.categorie && !ouverts(e).some((s) => s.categorie === filtres.categorie)) continue;
    if (filtres.gravite && i.gravite !== filtres.gravite) continue;
    liste.push(filtres.categorie ? { ...i, categorie: filtres.categorie } : i);
  }
  return liste.sort((a, b) => ORDRE_GRAVITE[b.gravite] - ORDRE_GRAVITE[a.gravite] || a.signaleeLe.localeCompare(b.signaleeLe));
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
