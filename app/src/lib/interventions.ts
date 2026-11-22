import { ORDRE_GRAVITE, type Categorie, type Endroit, type Gravite } from '../types';
import { endroitsOuverts, clesDeZone } from './selection';
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
