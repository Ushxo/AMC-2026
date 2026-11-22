import type { Equipe, Incident, NouvelIncident, NouvelleEquipe, TypeIncident } from '../types';
import { dansMontreal } from './geo';
import {
  MESSAGE_EQUIPE_ECHEC,
  MESSAGE_EQUIPE_INVALIDE,
  MESSAGE_HORS_MONTREAL,
  MESSAGE_INCIDENT_ECHEC,
} from './messages';
import { avecDelai } from './source';
import { getSupabase } from './supabase';

const DELAI_MS = 5000;

/** Colonnes ajoutées par la migration 0007 : si elle n'est pas lancée, on enregistre le reste sans elles. */
export const COLONNES_0007 = ['garage_adresse', 'arrivee_nom', 'arrivee_adresse', 'arrivee_latitude', 'arrivee_longitude'];
export const MESSAGE_ADRESSES_PAS_ENCORE =
  "Équipe enregistrée. Les adresses ne peuvent pas encore être gardées : cette fonction sera bientôt disponible.";

/** Vrai si l'erreur de la base dit qu'une colonne n'existe pas (migration pas encore lancée). */
export function colonneAbsente(erreur: unknown): boolean {
  const e = erreur as { code?: unknown; message?: unknown } | null;
  if (!e) return false;
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || (message.includes('column') && (message.includes('does not exist') || message.includes('schema cache')));
}

export function sansColonnes0007(l: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(l).filter(([k]) => !COLONNES_0007.includes(k)));
}

/** Écrit la ligne ; si les colonnes de la 0007 manquent, réécrit sans elles et le dit (jamais d'erreur brute). */
async function ecrireEquipe(
  ligne: Record<string, unknown>,
  operation: (l: Record<string, unknown>) => PromiseLike<{ error: unknown }>,
): Promise<string | null> {
  try {
    const { error } = await avecDelai(operation(ligne), DELAI_MS);
    if (!error) return null;
    const avecAdresses = Object.keys(ligne).some((k) => COLONNES_0007.includes(k));
    if (!avecAdresses || !colonneAbsente(error)) return MESSAGE_EQUIPE_ECHEC;
    const reste = sansColonnes0007(ligne);
    if (Object.keys(reste).length === 0) return MESSAGE_ADRESSES_PAS_ENCORE;
    const second = await avecDelai(operation(reste), DELAI_MS);
    return second.error ? MESSAGE_EQUIPE_ECHEC : MESSAGE_ADRESSES_PAS_ENCORE;
  } catch {
    return MESSAGE_EQUIPE_ECHEC;
  }
}

export function hhmm(v: string): string {
  return String(v).slice(0, 5);
}

export function equipeDepuisLigne(l: Record<string, unknown>): Equipe {
  return {
    id: l.id as string,
    nom: l.nom as string,
    membres: (l.membres as string[] | null) ?? [],
    vehicule: (l.vehicule as string | null) ?? null,
    garage: { latitude: Number(l.garage_latitude), longitude: Number(l.garage_longitude) },
    ...(l.garage_nom ? { garage_nom: l.garage_nom as string } : {}),
    ...(l.garage_adresse ? { garage_adresse: l.garage_adresse as string } : {}),
    // Adresse d'arrivée (migration 0007) : absente ou sans coordonnées = retour au garage.
    ...(l.arrivee_latitude != null && l.arrivee_longitude != null
      ? { arrivee: { latitude: Number(l.arrivee_latitude), longitude: Number(l.arrivee_longitude) } }
      : {}),
    ...(l.arrivee_nom ? { arrivee_nom: l.arrivee_nom as string } : {}),
    ...(l.arrivee_adresse ? { arrivee_adresse: l.arrivee_adresse as string } : {}),
    ...(l.compte_id ? { compte_id: l.compte_id as string } : {}),
    debut_quart: hhmm(l.debut_quart as string),
    fin_quart: hhmm(l.fin_quart as string),
    active: Boolean(l.active),
    exemple_demo: Boolean(l.exemple_demo),
  };
}

export function ligneDepuisEquipe(e: Partial<NouvelleEquipe>): Record<string, unknown> {
  const l: Record<string, unknown> = {};
  if (e.nom !== undefined) l.nom = e.nom.trim();
  if (e.membres !== undefined) l.membres = e.membres;
  if (e.vehicule !== undefined) l.vehicule = e.vehicule;
  if (e.garage !== undefined) {
    l.garage_latitude = e.garage.latitude;
    l.garage_longitude = e.garage.longitude;
  }
  if (e.garage_nom !== undefined) l.garage_nom = e.garage_nom;
  if (e.garage_adresse !== undefined) l.garage_adresse = e.garage_adresse;
  // arrivee : null = « même adresse que le départ » (les deux coordonnées vont ensemble).
  if (e.arrivee !== undefined) {
    l.arrivee_latitude = e.arrivee ? e.arrivee.latitude : null;
    l.arrivee_longitude = e.arrivee ? e.arrivee.longitude : null;
  }
  if (e.arrivee_nom !== undefined) l.arrivee_nom = e.arrivee_nom;
  if (e.arrivee_adresse !== undefined) l.arrivee_adresse = e.arrivee_adresse;
  if (e.debut_quart !== undefined) l.debut_quart = e.debut_quart;
  if (e.fin_quart !== undefined) l.fin_quart = e.fin_quart;
  if (e.active !== undefined) l.active = e.active;
  return l;
}

/** Message d'erreur en français simple, ou null si l'équipe est valide. `complete` : tous les champs sont donnés. */
export function validerEquipe(e: Partial<NouvelleEquipe>, complete: boolean): string | null {
  if (complete || e.nom !== undefined) {
    const nom = (e.nom ?? '').trim();
    if (nom.length < 1 || nom.length > 60) return MESSAGE_EQUIPE_INVALIDE;
  }
  if (e.garage && !dansMontreal(e.garage)) return MESSAGE_HORS_MONTREAL;
  if (e.debut_quart !== undefined && e.fin_quart !== undefined && e.fin_quart <= e.debut_quart) {
    return 'Le quart doit finir après son début.';
  }
  return null;
}

export async function lireEquipes(): Promise<Equipe[] | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(client.from('equipes').select('*').order('cree_le'), DELAI_MS);
    if (error || !data) return null;
    return data.map((l) => equipeDepuisLigne(l as Record<string, unknown>));
  } catch {
    return null;
  }
}

async function ecrire(
  operation: () => PromiseLike<{ error: unknown }>,
  message: string,
): Promise<string | null> {
  try {
    const { error } = await avecDelai(operation(), DELAI_MS);
    return error ? message : null;
  } catch {
    return message;
  }
}

export async function creerEquipe(e: NouvelleEquipe): Promise<string | null> {
  const invalide = validerEquipe(e, true);
  if (invalide) return invalide;
  const client = getSupabase();
  if (!client) return MESSAGE_EQUIPE_ECHEC;
  return ecrireEquipe(ligneDepuisEquipe({ active: true, ...e }), (l) => client.from('equipes').insert(l));
}

export async function modifierEquipe(id: string, champs: Partial<NouvelleEquipe>): Promise<string | null> {
  const invalide = validerEquipe(champs, false);
  if (invalide) return invalide;
  const client = getSupabase();
  if (!client) return MESSAGE_EQUIPE_ECHEC;
  return ecrireEquipe(ligneDepuisEquipe(champs), (l) => client.from('equipes').update(l).eq('id', id));
}

export async function desactiverEquipe(id: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return MESSAGE_EQUIPE_ECHEC;
  return ecrire(() => client.from('equipes').update({ active: false }).eq('id', id), MESSAGE_EQUIPE_ECHEC);
}

export function incidentDepuisLigne(l: Record<string, unknown>): Incident {
  return {
    id: l.id as string,
    type: l.type as TypeIncident,
    position: { latitude: Number(l.latitude), longitude: Number(l.longitude) },
    rayon_m: Number(l.rayon_m),
    description: (l.description as string | null) ?? null,
    actif: Boolean(l.actif),
    simule: true,
    cree_le: l.cree_le as string,
  };
}

export async function lireIncidents(): Promise<Incident[] | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(client.from('incidents').select('*').eq('actif', true).order('cree_le'), DELAI_MS);
    if (error || !data) return null;
    return data.map((l) => incidentDepuisLigne(l as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function ajouterIncident(n: NouvelIncident): Promise<string | null> {
  if (!dansMontreal(n.position)) return MESSAGE_HORS_MONTREAL;
  const client = getSupabase();
  if (!client) return MESSAGE_INCIDENT_ECHEC;
  return ecrire(
    () =>
      client.from('incidents').insert({
        type: n.type,
        latitude: n.position.latitude,
        longitude: n.position.longitude,
        rayon_m: n.rayon_m ?? 100,
        description: n.description ?? null,
        simule: true,
      }),
    MESSAGE_INCIDENT_ECHEC,
  );
}

export async function retirerIncident(id: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return MESSAGE_INCIDENT_ECHEC;
  return ecrire(() => client.from('incidents').update({ actif: false }).eq('id', id), MESSAGE_INCIDENT_ECHEC);
}
