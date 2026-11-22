import { useSyncExternalStore } from 'react';

import type { Arret, Tournee } from '../types';
import { avecDelai } from './source';
import { getSupabase } from './supabase';
import { idArret } from './trajet';

/** Évaluation d'un arrêt faite sur place par le responsable d'équipe. */
export type Evaluation = { regle: boolean; commentaire: string | null; evalue_le: string };

// --- Évaluations et rapports notés sur ce téléphone (affichage immédiat, démonstration, ou base pas encore relue) ---
type EtatRapport = { evaluations: ReadonlyMap<string, Evaluation>; envoyes: ReadonlyMap<string, string> };

let etat: EtatRapport = { evaluations: new Map(), envoyes: new Map() };
const ecouteurs = new Set<() => void>();

function changer(prochain: EtatRapport): void {
  etat = prochain;
  ecouteurs.forEach((f) => f());
}

/** État noté sur ce téléphone (évaluations et rapports envoyés). */
export function lireEtatRapport(): EtatRapport {
  return etat;
}

function abonner(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

export function useEtatRapport(): EtatRapport {
  return useSyncExternalStore(abonner, lireEtatRapport, lireEtatRapport);
}

export function reinitialiserRapport(): void {
  changer({ evaluations: new Map(), envoyes: new Map() });
}

/** Évaluation connue d'un arrêt : celle notée sur ce téléphone, sinon celle de la base. Un arrêt « fait » sans évaluation compte comme réglé. */
export function evaluationDe(a: Arret, locales: ReadonlyMap<string, Evaluation>): Evaluation | null {
  const locale = locales.get(idArret(a));
  if (locale) return locale;
  if (a.evalue_le && a.regle != null) return { regle: a.regle, commentaire: a.commentaire ?? null, evalue_le: a.evalue_le };
  if (a.fait) return { regle: true, commentaire: null, evalue_le: a.fait_le ?? '' };
  return null;
}

/** Moment d'envoi du rapport de cette tournée, s'il est parti. */
export function rapportEnvoyeLe(t: Tournee, envoyes: ReadonlyMap<string, string>): string | null {
  return envoyes.get(t.id ?? t.equipe_id) ?? t.rapport_envoye_le ?? null;
}

/**
 * Enregistre l'évaluation d'un arrêt (sur ce téléphone tout de suite, puis dans la base si l'arrêt y existe).
 * Rend false si la base a refusé l'écriture (l'évaluation reste notée sur ce téléphone).
 */
export async function ecrireEvaluation(a: Arret, regle: boolean, commentaire: string): Promise<boolean> {
  const evaluation: Evaluation = { regle, commentaire: regle ? null : commentaire.trim(), evalue_le: new Date().toISOString() };
  const evaluations = new Map(etat.evaluations);
  evaluations.set(idArret(a), evaluation);
  changer({ ...etat, evaluations });

  const client = getSupabase();
  if (!client || !a.id) return true; // démonstration ou résultat précalculé : rien à écrire
  try {
    const { data, error } = await avecDelai(
      client
        .from('arrets')
        .update({ regle: evaluation.regle, commentaire: evaluation.commentaire, evalue_le: evaluation.evalue_le })
        .eq('id', a.id)
        .select('id'),
    );
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/** Envoie le rapport de la tournée au superviseur. Rend false si la base l'a refusé. */
export async function envoyerRapport(t: Tournee): Promise<boolean> {
  const cle = t.id ?? t.equipe_id;
  const client = getSupabase();
  let moment = new Date().toISOString();
  if (client && t.id) {
    try {
      const { data, error } = await avecDelai(client.rpc('envoyer_rapport', { p_tournee: t.id }));
      if (error) return false;
      if (typeof data === 'string') moment = data;
    } catch {
      return false;
    }
  }
  const envoyes = new Map(etat.envoyes);
  envoyes.set(cle, moment);
  changer({ ...etat, envoyes });
  return true;
}
