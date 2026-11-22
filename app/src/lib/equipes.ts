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
  return ecrire(() => client.from('equipes').insert(ligneDepuisEquipe({ active: true, ...e })), MESSAGE_EQUIPE_ECHEC);
}

export async function modifierEquipe(id: string, champs: Partial<NouvelleEquipe>): Promise<string | null> {
  const invalide = validerEquipe(champs, false);
  if (invalide) return invalide;
  const client = getSupabase();
  if (!client) return MESSAGE_EQUIPE_ECHEC;
  return ecrire(() => client.from('equipes').update(ligneDepuisEquipe(champs)).eq('id', id), MESSAGE_EQUIPE_ECHEC);
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
