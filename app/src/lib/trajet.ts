import { useSyncExternalStore } from 'react';

import type { Arret, Coordonnees, ResultatOptimisation, Tournee } from '../types';
import type { Region } from './config';
import { avecDelai } from './source';
import { getSupabase } from './supabase';

/** Identifiant d'un arrêt : son id en base, sinon sa clé d'endroit (résultat précalculé). */
export function idArret(a: Pick<Arret, 'id' | 'cle_endroit'>): string {
  return a.id ?? a.cle_endroit;
}

export function trouverTournee(resultat: ResultatOptimisation | null, equipeId: string): Tournee | null {
  return resultat?.tournees.find((t) => t.equipe_id === equipeId) ?? null;
}

export function arretsTries(t: Tournee): Arret[] {
  return [...t.arrets].sort((a, b) => a.rang - b.rang);
}

/** Premier arrêt pas encore fait, dans l'ordre de la tournée. */
export function prochainArret(t: Tournee, estFait: (a: Arret) => boolean): Arret | null {
  return arretsTries(t).find((a) => !estFait(a)) ?? null;
}

/** Zone qui contient tous les points, avec une marge. */
export function regionAutour(points: Coordonnees[], defaut: Region): Region {
  if (points.length === 0) return defaut;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.3),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.3),
  };
}

// --- Arrêts faits notés sur ce téléphone (démonstration, hors ligne, ou en attendant la lecture de la base) ---
type EtatTrajet = { faits: ReadonlySet<string>; partiels: ReadonlySet<string> };

let etat: EtatTrajet = { faits: new Set(), partiels: new Set() };
const ecouteurs = new Set<() => void>();

function changer(prochain: EtatTrajet): void {
  etat = prochain;
  ecouteurs.forEach((f) => f());
}

export function lireEtatTrajet(): EtatTrajet {
  return etat;
}

export function noterFaitLocal(id: string): void {
  if (etat.faits.has(id)) return;
  changer({ ...etat, faits: new Set([...etat.faits, id]) });
}

/** Arrêt noté fait, mais dont tous les signalements ne sont pas encore réglés : on peut réessayer. */
export function noterPartiel(id: string, partiel: boolean): void {
  if (etat.partiels.has(id) === partiel) return;
  const suivants = new Set(etat.partiels);
  if (partiel) suivants.add(id);
  else suivants.delete(id);
  changer({ ...etat, partiels: suivants });
}

export function reinitialiserTrajet(): void {
  changer({ faits: new Set(), partiels: new Set() });
}

export function abonnerTrajet(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

export function useEtatTrajet(): EtatTrajet {
  return useSyncExternalStore(abonnerTrajet, lireEtatTrajet, lireEtatTrajet);
}

/** Écrit `fait` et `fait_le` sur l'arrêt (droit des employés). Rend true si la base l'a pris. */
export async function ecrireArretFait(arretId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data, error } = await avecDelai(
      client
        .from('arrets')
        .update({ fait: true, fait_le: new Date().toISOString() })
        .eq('id', arretId)
        .select('id'),
    );
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
