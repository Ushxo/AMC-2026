import { ORDRE_GRAVITE } from '../types';
import type { Endroit, Etat, Gravite, Signalement } from '../types';
import { PAS_CASE, SEUIL_ELEVEE, SEUIL_MOYENNE } from './config';

export function graviteParNombre(n: number): Gravite {
  if (n >= SEUIL_ELEVEE) return 'elevee';
  if (n >= SEUIL_MOYENNE) return 'moyenne';
  return 'faible';
}

export function graviteMax(a: Gravite, b: Gravite): Gravite {
  return ORDRE_GRAVITE[a] >= ORDRE_GRAVITE[b] ? a : b;
}

function arrondir(v: number): string {
  return (Math.round(v / PAS_CASE) * PAS_CASE).toFixed(4);
}

export function cleEndroit(s: Pick<Signalement, 'grille_id' | 'latitude' | 'longitude'>): string {
  if (s.grille_id) return `grille:${s.grille_id}`;
  return `case:${arrondir(s.latitude)}:${arrondir(s.longitude)}`;
}

const AVANCEMENT_OUVERT: Partial<Record<Etat, number>> = { nouveau: 0, pris_en_charge: 1 };

function etatDominant(liste: Signalement[]): Etat {
  const ouverts = liste.filter((s) => s.etat in AVANCEMENT_OUVERT);
  if (ouverts.length > 0) {
    return ouverts.reduce((a, b) =>
      AVANCEMENT_OUVERT[b.etat]! < AVANCEMENT_OUVERT[a.etat]! ? b : a,
    ).etat;
  }
  return liste.some((s) => s.etat === 'regle') ? 'regle' : 'rejete';
}

/** Regroupe par endroit. Le nombre compte seulement les signalements ouverts (nouveau, pris en charge). */
export function regrouper(signalements: Signalement[]): Endroit[] {
  const groupes = new Map<string, Signalement[]>();
  for (const s of signalements) {
    const cle = cleEndroit(s);
    const g = groupes.get(cle);
    if (g) g.push(s);
    else groupes.set(cle, [s]);
  }
  const endroits: Endroit[] = [];
  for (const [cle, liste] of groupes) {
    const comptes = liste.filter((s) => s.etat in AVANCEMENT_OUVERT);
    const nombre = comptes.length;
    const base = comptes.length > 0 ? comptes : liste;
    const choisie = base.reduce<Gravite>((m, s) => graviteMax(m, s.gravite), 'faible');
    const parNombre = graviteParNombre(nombre);
    endroits.push({
      cle,
      position: {
        latitude: liste.reduce((t, s) => t + s.latitude, 0) / liste.length,
        longitude: liste.reduce((t, s) => t + s.longitude, 0) / liste.length,
      },
      nombre,
      gravite_choisie_max: choisie,
      gravite_par_nombre: parNombre,
      gravite_affichee: graviteMax(choisie, parNombre),
      etat_dominant: etatDominant(liste),
      signalements: liste,
    });
  }
  return endroits;
}

function plusRecent(e: Endroit): number {
  return e.signalements.reduce((m, s) => Math.max(m, Date.parse(s.cree_le) || 0), 0);
}

export function trierEndroits(endroits: Endroit[]): Endroit[] {
  return [...endroits].sort(
    (a, b) =>
      ORDRE_GRAVITE[b.gravite_affichee] - ORDRE_GRAVITE[a.gravite_affichee] ||
      plusRecent(b) - plusRecent(a),
  );
}
