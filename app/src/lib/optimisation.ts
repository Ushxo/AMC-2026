import type {
  Arret,
  DemandeOptimisation,
  Incident,
  ParametresOptimisation,
  ResultatOptimisation,
  ResultatPrecalcule,
} from '../types';
import { estRefusOuAbsent } from './auth';
import { abonnerTable } from './canal-partage';
import { MESSAGE_OPTIMISATION_ECHEC } from './messages';
import { avecDelai } from './source';
import { getSupabase } from './supabase';
import {
  assemblerResultat,
  COMPARAISON_VIDE,
  demandeDepuisLigne,
  type LigneDemande,
} from './tournees';

const DELAI_LECTURE_MS = 5000;

function essayer<T>(charger: () => T): T | null {
  try {
    return charger();
  } catch {
    return null;
  }
}

/** Résultat embarqué (copie de data/out/). Null si le fichier manque. */
export function chargerPrecalcule(avecIncident: boolean): ResultatPrecalcule | null {
  const brut = avecIncident
    ? essayer(() => require('../donnees/tournees-demo-incident.json'))
    : essayer(() => require('../donnees/tournees-demo.json'));
  if (!brut || !Array.isArray((brut as ResultatPrecalcule).tournees)) return null;
  return brut as ResultatPrecalcule;
}

export function parametresParDefaut(p?: Partial<ParametresOptimisation>): ParametresOptimisation {
  return {
    version: 1,
    equipe_ids: [],
    incident_ids: [],
    affectations_forcees: [],
    limite_secondes: 8,
    ...p,
  };
}

/** Écrit une demande « en_attente ». Rend son identifiant, ou un message d'erreur. */
export async function creerDemande(
  p?: Partial<ParametresOptimisation>,
): Promise<{ id: string } | { erreur: string }> {
  const client = getSupabase();
  if (!client) return { erreur: MESSAGE_OPTIMISATION_ECHEC };
  try {
    const { data, error } = await avecDelai(
      client
        .from('demandes_optimisation')
        .insert({ parametres: parametresParDefaut(p) })
        .select('id')
        .single(),
      DELAI_LECTURE_MS,
    );
    if (error || !data || typeof data.id !== 'string') return { erreur: MESSAGE_OPTIMISATION_ECHEC };
    return { id: data.id };
  } catch {
    return { erreur: MESSAGE_OPTIMISATION_ECHEC };
  }
}

export async function lireDemande(id: string): Promise<DemandeOptimisation | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(
      client.from('demandes_optimisation').select('*').eq('id', id).maybeSingle(),
      DELAI_LECTURE_MS,
    );
    if (error || !data || !data.id) return null;
    return demandeDepuisLigne(data as Parameters<typeof demandeDepuisLigne>[0]);
  } catch {
    return null;
  }
}

/** Dernière optimisation terminée, avec ses tournées et ses arrêts. Réservé aux employés (règles de la base). */
export async function lireDerniereTerminee(): Promise<ResultatOptimisation | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const demandes = await avecDelai(
      client
        .from('demandes_optimisation')
        .select('*')
        .eq('statut', 'terminee')
        .order('termine_le', { ascending: false })
        .limit(1),
      DELAI_LECTURE_MS,
    );
    const demande = demandes.data?.[0] as LigneDemande | undefined;
    if (demandes.error || !demande) return null;
    const idsIncidents = demande.parametres?.incident_ids ?? [];
    const [tournees, arrets, equipes, incidents] = await avecDelai(
      Promise.all([
        client.from('tournees').select('*').eq('demande_id', demande.id),
        client.from('arrets').select('*').eq('demande_id', demande.id),
        client.from('equipes').select('id, nom'),
        // Les incidents du calcul : ceux enregistrés avec la demande (même retirés depuis), pas les actifs du moment.
        idsIncidents.length > 0
          ? client.from('incidents').select('*').in('id', idsIncidents)
          : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      ]),
      DELAI_LECTURE_MS,
    );
    if (tournees.error || arrets.error) return null;
    const incidentsContrat: Pick<Incident, 'id' | 'type' | 'position' | 'rayon_m' | 'simule'>[] = (
      incidents.data ?? []
    ).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      type: i.type as Incident['type'],
      position: { latitude: Number(i.latitude), longitude: Number(i.longitude) },
      rayon_m: Number(i.rayon_m),
      simule: true as const,
    }));
    return assemblerResultat(
      demande,
      tournees.data ?? [],
      arrets.data ?? [],
      equipes.data ?? [],
      incidentsContrat,
      COMPARAISON_VIDE,
    );
  } catch {
    return null;
  }
}

export type Passage = Pick<Arret, 'rang' | 'arrivee_prevue' | 'depart_prevu'> & { fait?: boolean };

function passageDepuisLigne(l: Record<string, unknown>): Passage {
  return {
    rang: Number(l.rang),
    arrivee_prevue: l.arrivee_prevue as string,
    depart_prevu: l.depart_prevu as string,
    fait: Boolean(l.fait),
  };
}

/**
 * Passage publié d'un signalement (fonction `passage_signalement` : rang et heures seulement, rien d'autre).
 * Avant la migration 0004 la fonction n'existe pas : repli sur la lecture directe des arrêts.
 * Rend null s'il n'y a pas de passage ; lève une erreur si la lecture échoue (l'appelant garde alors l'état précédent).
 */
export async function lireArretPourSignalement(signalementId: string): Promise<Passage | null> {
  const client = getSupabase();
  if (!client) return null;
  const r = await avecDelai(client.rpc('passage_signalement', { p_signalement: signalementId }), DELAI_LECTURE_MS);
  if (!r.error) {
    const ligne = Array.isArray(r.data) ? r.data[0] : r.data;
    return ligne ? passageDepuisLigne(ligne as Record<string, unknown>) : null;
  }
  if (!estRefusOuAbsent(r.error)) throw r.error;
  const { data, error } = await avecDelai(
    client.from('arrets').select('*').contains('signalement_ids', [signalementId]).limit(1),
    DELAI_LECTURE_MS,
  );
  if (error) throw error;
  return data && data.length > 0 ? passageDepuisLigne(data[0] as Record<string, unknown>) : null;
}

/** Réveille `rappel` à chaque changement des demandes (Realtime). Rend la fonction d'arrêt. */
export function abonnerDemandes(rappel: () => void): () => void {
  return abonnerTable('demandes_optimisation', rappel);
}
