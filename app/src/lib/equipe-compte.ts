import type { PositionEquipe } from '../types';
import { estRefusOuAbsent } from './auth';
import {
  MESSAGE_COMPTE_AUCUN,
  MESSAGE_COMPTE_ECHEC,
  MESSAGE_COMPTE_INDISPONIBLE,
  MESSAGE_COMPTE_RESERVE,
} from './messages';
import { avecDelai } from './source';
import { getSupabase } from './supabase';

const DELAI_MS = 5000;

/** Message lisible pour une erreur de la base sur l'association d'un compte. */
export function messageCompte(erreur: unknown): string {
  const texte = String((erreur as { message?: unknown } | null)?.message ?? '');
  if (/Aucun compte/i.test(texte)) return MESSAGE_COMPTE_AUCUN;
  if (/Réservé aux superviseurs/i.test(texte)) return MESSAGE_COMPTE_RESERVE;
  if (/could not find the function|does not exist|PGRST202/i.test(texte)) return MESSAGE_COMPTE_INDISPONIBLE;
  if (estRefusOuAbsent(erreur)) return MESSAGE_COMPTE_INDISPONIBLE;
  return MESSAGE_COMPTE_ECHEC;
}

export async function associerCompte(courriel: string, equipeId: string): Promise<string | null> {
  const c = courriel.trim();
  if (c.length < 3 || !c.includes('@')) return 'Entrez le courriel du compte.';
  const client = getSupabase();
  if (!client) return MESSAGE_COMPTE_ECHEC;
  try {
    const { error } = await avecDelai(client.rpc('associer_compte_equipe', { p_courriel: c, p_equipe: equipeId }), DELAI_MS);
    return error ? messageCompte(error) : null;
  } catch {
    return MESSAGE_COMPTE_ECHEC;
  }
}

export async function dissocierCompte(equipeId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return MESSAGE_COMPTE_ECHEC;
  try {
    const { error } = await avecDelai(client.rpc('dissocier_compte_equipe', { p_equipe: equipeId }), DELAI_MS);
    return error ? messageCompte(error) : null;
  } catch {
    return MESSAGE_COMPTE_ECHEC;
  }
}

/** Équipe du compte connecté. `disponible` faux si la fonction n'existe pas encore (migration pas lancée). */
export async function lireMonEquipe(): Promise<{ equipeId: string | null; disponible: boolean }> {
  const client = getSupabase();
  if (!client) return { equipeId: null, disponible: false };
  try {
    const { data, error } = await avecDelai(client.rpc('mon_equipe'), DELAI_MS);
    if (error) return { equipeId: null, disponible: !estRefusOuAbsent(error) };
    return { equipeId: typeof data === 'string' ? data : null, disponible: true };
  } catch {
    return { equipeId: null, disponible: false };
  }
}

export function positionDepuisLigne(l: Record<string, unknown>): PositionEquipe {
  return {
    equipe_id: l.equipe_id as string,
    position: { latitude: Number(l.latitude), longitude: Number(l.longitude) },
    cap: l.cap === null || l.cap === undefined ? null : Number(l.cap),
    maj_le: l.maj_le as string,
  };
}

/** Dernières positions des équipes (employés seulement). Null si la table n'existe pas encore ou si la lecture échoue. */
export async function lirePositionsEquipes(): Promise<PositionEquipe[] | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await avecDelai(client.from('positions_equipes').select('*'), DELAI_MS);
    if (error || !data) return null;
    return data.map((l) => positionDepuisLigne(l as Record<string, unknown>));
  } catch {
    return null;
  }
}

/** Remplace la dernière position de l'équipe (l'heure et l'auteur sont imposés par le serveur). Rend true si la base l'a prise. */
export async function envoyerPosition(
  equipeId: string,
  position: { latitude: number; longitude: number },
  cap: number | null,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await avecDelai(
      client.from('positions_equipes').upsert(
        {
          equipe_id: equipeId,
          latitude: position.latitude,
          longitude: position.longitude,
          cap: cap === null || !Number.isFinite(cap) ? null : ((cap % 360) + 360) % 360,
        },
        { onConflict: 'equipe_id' },
      ),
      DELAI_MS,
    );
    return !error;
  } catch {
    return false;
  }
}

export function abonnerPositions(rappel: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  try {
    const canal = client
      .channel(`positions-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions_equipes' }, rappel)
      .subscribe();
    return () => {
      void client.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}
