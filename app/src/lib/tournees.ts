import type {
  Arret,
  Comparaison,
  DemandeOptimisation,
  Equipe,
  Incident,
  ResultatOptimisation,
  Tournee,
} from '../types';
import { formaterDuree, formaterKm } from './temps';

type LigneArret = {
  id: string;
  tournee_id: string;
  rang: number;
  cle_endroit: string;
  signalement_ids: string[];
  latitude: number;
  longitude: number;
  arrivee_prevue: string;
  depart_prevu: string;
  fait?: boolean;
};

type LigneTournee = {
  id: string;
  equipe_id: string;
  distance_m: number;
  duree_s: number;
  debut_prevu: string;
  fin_prevue: string;
  geometrie: Tournee['geometrie'];
};

export type LigneDemande = {
  id: string;
  statut: string;
  message: string | null;
  termine_le: string | null;
  cree_le: string;
  comparaison: Comparaison | null;
  non_servis: ResultatOptimisation['non_servis'] | null;
  source_matrice: ResultatOptimisation['source_matrice'] | null;
  parametres?: { incident_ids?: string[] } | null;
};

/** Recompose un ResultatOptimisation depuis les lignes de la base (demande, tournées, arrêts). */
export function assemblerResultat(
  demande: LigneDemande,
  tournees: LigneTournee[],
  arrets: LigneArret[],
  equipes: Pick<Equipe, 'id' | 'nom'>[],
  incidents: Pick<Incident, 'id' | 'type' | 'position' | 'rayon_m' | 'simule'>[],
  comparaisonVide: Comparaison,
): ResultatOptimisation {
  const noms = new Map(equipes.map((e) => [e.id, e.nom]));
  return {
    version: 1,
    demande_id: demande.id,
    statut: 'terminee',
    message: null,
    calcule_le: demande.termine_le ?? demande.cree_le,
    duree_calcul_ms: 0,
    source_matrice: demande.source_matrice ?? 'osrm_cache',
    precalcule: false,
    incidents,
    tournees: tournees.map((t) => ({
      id: t.id,
      equipe_id: t.equipe_id,
      equipe_nom: noms.get(t.equipe_id) ?? 'Équipe',
      distance_m: t.distance_m,
      duree_s: t.duree_s,
      debut_prevu: t.debut_prevu,
      fin_prevue: t.fin_prevue,
      geometrie: t.geometrie,
      arrets: arrets
        .filter((a) => a.tournee_id === t.id)
        .sort((a, b) => a.rang - b.rang)
        .map<Arret>((a) => ({
          id: a.id,
          rang: a.rang,
          cle_endroit: a.cle_endroit,
          signalement_ids: a.signalement_ids,
          position: { latitude: a.latitude, longitude: a.longitude },
          arrivee_prevue: a.arrivee_prevue,
          depart_prevu: a.depart_prevu,
          fait: a.fait,
        })),
    })),
    non_servis: demande.non_servis ?? [],
    comparaison: demande.comparaison ?? comparaisonVide,
  };
}

export const COMPARAISON_VIDE: Comparaison = {
  ordre_arrivee: { distance_m: 0, duree_s: 0, arrets_servis: 0, depassement_quart_s: 0 },
  optimise: { distance_m: 0, duree_s: 0, arrets_servis: 0 },
  gain_distance_m: 0,
  gain_duree_s: 0,
  dans_le_quart: { ordre_arrivee: 0, optimise: 0, arrets_en_plus: 0 },
};

/** Points du tracé d'une tournée : géométrie OSRM si elle existe, sinon segments droits entre les arrêts. */
export function pointsTournee(
  t: Tournee,
  garage?: { latitude: number; longitude: number } | null,
): { latitude: number; longitude: number }[] {
  if (t.geometrie && t.geometrie.coordinates.length > 1) {
    return t.geometrie.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  const pts = [...t.arrets].sort((a, b) => a.rang - b.rang).map((a) => a.position);
  return garage ? [garage, ...pts, garage] : pts;
}

export type LigneGain = { etiquette: string; valeur: string };

/** Textes du gain « à travail égal », puis la mesure séparée des arrêts servis dans le quart. */
export function resumerGain(c: Comparaison): { egal: LigneGain[]; dansLeQuart: string } {
  const egal: LigneGain[] = [
    { etiquette: 'Kilomètres en moins', valeur: formaterKm(c.gain_distance_m) },
    { etiquette: 'Heures en moins', valeur: formaterDuree(c.gain_duree_s) },
    { etiquette: "Dépassement du quart de l'ordre d'arrivée", valeur: formaterDuree(c.ordre_arrivee.depassement_quart_s) },
  ];
  const e = c.dans_le_quart;
  const dansLeQuart = `Dans le quart : ${e.optimise} arrêts servis contre ${e.ordre_arrivee} (${e.arrets_en_plus} de plus).`;
  return { egal, dansLeQuart };
}

export function demandeDepuisLigne(l: LigneDemande & { parametres: DemandeOptimisation['parametres']; commence_le: string | null }): DemandeOptimisation {
  return {
    id: l.id,
    cree_le: l.cree_le,
    statut: l.statut as DemandeOptimisation['statut'],
    parametres: l.parametres,
    message: l.message,
    commence_le: l.commence_le,
    termine_le: l.termine_le,
  };
}

function estPosition(p: unknown): p is { latitude: number; longitude: number } {
  const q = p as { latitude?: unknown; longitude?: unknown } | null;
  return !!q && Number.isFinite(q.latitude) && Number.isFinite(q.longitude);
}

/**
 * Rend un résultat sûr à afficher : listes toujours présentes, éléments vides ou mal formés écartés,
 * comparaison complétée. Un résultat inutilisable devient null. Aucun écran ne lit alors un champ d'un élément absent.
 */
export function nettoyerResultat(r: ResultatOptimisation | null | undefined): ResultatOptimisation | null {
  if (!r || typeof r !== 'object' || !Array.isArray(r.tournees)) return null;
  const tournees = r.tournees
    .filter((t): t is Tournee => !!t && typeof t === 'object' && typeof t.equipe_id === 'string' && Array.isArray(t.arrets))
    .map((t) => ({
      ...t,
      arrets: t.arrets.filter(
        (a): a is Arret => !!a && typeof a === 'object' && Number.isFinite(a.rang) && estPosition(a.position),
      ),
    }));
  const c = (r.comparaison ?? {}) as Partial<Comparaison>;
  return {
    ...r,
    incidents: (Array.isArray(r.incidents) ? r.incidents : []).filter(
      (i) => !!i && typeof i === 'object' && typeof i.id === 'string' && estPosition(i.position),
    ),
    tournees,
    non_servis: (Array.isArray(r.non_servis) ? r.non_servis : []).filter((n) => !!n && typeof n === 'object'),
    comparaison: {
      ...COMPARAISON_VIDE,
      ...c,
      ordre_arrivee: { ...COMPARAISON_VIDE.ordre_arrivee, ...(c.ordre_arrivee ?? {}) },
      optimise: { ...COMPARAISON_VIDE.optimise, ...(c.optimise ?? {}) },
      dans_le_quart: { ...COMPARAISON_VIDE.dans_le_quart, ...(c.dans_le_quart ?? {}) },
    },
  };
}
