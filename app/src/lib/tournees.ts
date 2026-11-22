import type {
  Arret,
  Comparaison,
  DemandeOptimisation,
  Equipe,
  Incident,
  ResultatOptimisation,
  Tournee,
} from '../types';
import { distanceM } from './geo';
import { formaterDuree, formaterHeure, formaterKm } from './temps';

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
  fait_le?: string | null;
};

type LigneTournee = {
  id: string;
  equipe_id: string;
  distance_m: number;
  duree_s: number;
  debut_prevu: string;
  fin_prevue: string;
  geometrie: Tournee['geometrie'];
  /** Départ, fin, recalcul partiel (colonne ajoutée par la migration 0006 ; absente tant qu'elle n'est pas lancée). */
  details?: Record<string, unknown> | null;
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

/** Champs de départ, de fin et de recalcul lus dans `details` ; absent, vide ou invalide = garage, garage. */
export function detailsTournee(d: unknown): Partial<Pick<Tournee, 'depart' | 'depart_position' | 'fin' | 'fin_nom' | 'fin_position' | 'conservee' | 'recalculee' | 'faits_conserves'>> {
  if (!d || typeof d !== 'object') return {};
  const x = d as Record<string, unknown>;
  const r: ReturnType<typeof detailsTournee> = {};
  if (x.depart === 'garage' || x.depart === 'position') r.depart = x.depart;
  if (estPosition(x.depart_position)) r.depart_position = { latitude: x.depart_position.latitude, longitude: x.depart_position.longitude };
  if (x.fin === 'garage' || x.fin === 'arrivee' || x.fin === 'libre' || x.fin === 'endroit') r.fin = x.fin;
  if (typeof x.fin_nom === 'string' && x.fin_nom.trim()) r.fin_nom = x.fin_nom;
  if (estPosition(x.fin_position)) r.fin_position = { latitude: x.fin_position.latitude, longitude: x.fin_position.longitude };
  if (x.conservee === true) r.conservee = true;
  if (x.recalculee === true) r.recalculee = true;
  if (typeof x.faits_conserves === 'number') r.faits_conserves = x.faits_conserves;
  return r;
}

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
          ...(a.fait_le ? { fait_le: a.fait_le } : {}),
        })),
      ...detailsTournee(t.details),
    })),
    non_servis: demande.non_servis ?? [],
    comparaison: demande.comparaison ?? comparaisonVide,
    ...(demande.comparaison?.portee ? { portee: demande.comparaison.portee } : {}),
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
  arrivee?: { latitude: number; longitude: number } | null,
): { latitude: number; longitude: number }[] {
  if (t.geometrie && t.geometrie.coordinates.length > 1) {
    return t.geometrie.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  const pts = [...t.arrets].sort((a, b) => a.rang - b.rang).map((a) => a.position);
  const depart = t.depart === 'position' && t.depart_position ? t.depart_position : garage;
  // Fin : retour au garage (défaut) ; fin libre = pas de retour ; fin à un endroit = on finit sur cet endroit (déjà dernier arrêt).
  const fin = t.fin === 'libre' || t.fin === 'endroit' ? null : (t.fin_position ?? arrivee ?? garage);
  return [...(depart ? [depart] : []), ...pts, ...(fin ? [fin] : [])];
}

/**
 * Dernière destination après le dernier arrêt : le garage (fin = garage), l'endroit de fin (fin = endroit, sauf s'il est déjà
 * le dernier arrêt), ou rien (fin libre). Rend aussi le mot à employer à l'écran.
 */
export function cibleFinTournee(
  t: Pick<Tournee, 'fin' | 'fin_position' | 'arrets'>,
  garage: { latitude: number; longitude: number } | null,
  arriveeEquipe?: { latitude: number; longitude: number } | null,
): { position: { latitude: number; longitude: number }; nom: 'garage' | 'fin' } | null {
  const fin = t.fin ?? 'garage';
  if (fin === 'garage' || fin === 'arrivee') {
    // L'adresse d'arrivée de l'équipe (si elle en a une autre que le garage) ; la position donnée par le service l'emporte.
    const p = t.fin_position ?? arriveeEquipe ?? garage;
    if (!p) return null;
    const estGarage = !!garage && distanceM(p, garage) <= 30;
    return { position: p, nom: estGarage ? 'garage' : 'fin' };
  }
  if (fin !== 'endroit' || !t.fin_position) return null;
  const dernier = [...t.arrets].sort((a, b) => a.rang - b.rang).at(-1)?.position;
  if (dernier && distanceM(dernier, t.fin_position) <= 30) return null; // déjà sur place
  return { position: t.fin_position, nom: 'fin' };
}

/** « Départ : position de l'équipe » ou « Départ : garage (simulé) » (le garage est un point de démonstration). */
export function libelleDepart(t: Pick<Tournee, 'depart'>): string {
  return t.depart === 'position' ? "Départ : position de l'équipe" : 'Départ : garage (simulé)';
}

/** « Fin : retour au garage », « Fin : au dernier arrêt » ou « Fin : à l'endroit choisi ». */
export function libelleFin(t: Pick<Tournee, 'fin'>): string {
  if (t.fin === 'arrivee') return "Fin : à l'adresse d'arrivée";
  return t.fin === 'libre' ? 'Fin : au dernier arrêt' : t.fin === 'endroit' ? "Fin : à l'endroit choisi" : 'Fin : retour au garage';
}

type EquipeAdresses = Partial<Pick<Equipe, 'garage_adresse' | 'arrivee' | 'arrivee_adresse'>> | null | undefined;

/**
 * « Départ : garage, 800 rue X », « Départ : garage (simulé) » ou « Départ : position de l'équipe (22 h 14) ».
 * `prefixe` : « Départ prévu » dans l'aperçu, avant le démarrage.
 */
export function libelleDepartPlan(
  t: Pick<Tournee, 'depart'>,
  equipe: EquipeAdresses,
  majPosition?: string | null,
  prefixe = 'Départ',
): string {
  if (t.depart === 'position') return `${prefixe} : position de l'équipe${majPosition ? ` (${formaterHeure(majPosition)})` : ''}`;
  return `${prefixe} : garage${equipe?.garage_adresse ? `, ${equipe.garage_adresse}` : ' (simulé)'}`;
}

/** « Arrivée : garage, 800 rue X », « Arrivée : 12 rue Y », « Arrivée : au dernier arrêt » ou « Arrivée : à l'endroit choisi ». */
export function libelleArriveePlan(t: Pick<Tournee, 'fin' | 'fin_nom'>, equipe: EquipeAdresses): string {
  if (t.fin === 'libre') return 'Arrivée : au dernier arrêt';
  if (t.fin === 'arrivee') return `Arrivée : ${t.fin_nom ?? equipe?.arrivee_adresse ?? "adresse d'arrivée de l'équipe"}`;
  if (t.fin === 'endroit') return "Arrivée : à l'endroit choisi";
  if (equipe?.arrivee) return `Arrivée : ${equipe.arrivee_adresse ?? "adresse d'arrivée de l'équipe"}`;
  return `Arrivée : garage${equipe?.garage_adresse ? `, ${equipe.garage_adresse}` : ' (simulé)'}`;
}

/** Vrai si on a demandé le départ à la position mais que le service a pris le garage (position trop ancienne). */
export function positionTropAncienne(departDemande: 'garage' | 'position' | undefined, t: Pick<Tournee, 'depart'>): boolean {
  return departDemande === 'position' && (t.depart ?? 'garage') === 'garage';
}

export const MESSAGE_POSITION_TROP_ANCIENNE = "Position de l'équipe trop ancienne : départ au garage";

/** Un recalcul d'une seule équipe est « partiel » : le gain du plan complet ne s'applique pas. */
export function estPartiel(r: Pick<ResultatOptimisation, 'portee' | 'comparaison'>): boolean {
  return (r.portee ?? r.comparaison?.portee) === 'partiel';
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
