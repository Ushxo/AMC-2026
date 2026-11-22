import { useSyncExternalStore } from 'react';

import type { Arret, Coordonnees, ResultatOptimisation, Tournee } from '../types';
import { distanceM } from './geo';
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

// --- Résultats d'arrêts notés sur ce téléphone (démonstration, hors ligne, ou en attendant la lecture de la base) ---
/** Résultat local d'un arrêt « non fait » : le mot de l'équipe et l'heure. */
export type NonFaitLocal = { commentaire: string | null; traiteLe: string };
type EtatTrajet = {
  faits: ReadonlySet<string>;
  partiels: ReadonlySet<string>;
  /** Arrêts déclarés non faits sur ce téléphone, avec leur commentaire. */
  nonFaits: ReadonlyMap<string, NonFaitLocal>;
  /** Commentaires (facultatifs) des arrêts faits sur ce téléphone. */
  notes: ReadonlyMap<string, string>;
};

const ETAT_VIDE: EtatTrajet = { faits: new Set(), partiels: new Set(), nonFaits: new Map(), notes: new Map() };
let etat: EtatTrajet = ETAT_VIDE;
const ecouteurs = new Set<() => void>();

function changer(prochain: EtatTrajet): void {
  etat = prochain;
  ecouteurs.forEach((f) => f());
}

export function lireEtatTrajet(): EtatTrajet {
  return etat;
}

function sans<K, V>(m: ReadonlyMap<K, V>, cle: K): ReadonlyMap<K, V> {
  if (!m.has(cle)) return m;
  const n = new Map(m);
  n.delete(cle);
  return n;
}

/** Arrêt fait (Oui), avec un commentaire facultatif. Corrige un « non fait » noté avant. */
export function noterFaitLocal(id: string, commentaire?: string | null): void {
  const note = commentaire?.trim() ?? '';
  const dejaFait = etat.faits.has(id);
  if (dejaFait && !etat.nonFaits.has(id) && (etat.notes.get(id) ?? '') === note) return;
  const notes = new Map(etat.notes);
  if (note) notes.set(id, note);
  else notes.delete(id);
  changer({ ...etat, faits: new Set([...etat.faits, id]), nonFaits: sans(etat.nonFaits, id), notes });
}

/** Arrêt non fait (Non), avec son commentaire. Corrige un « fait » noté avant. Compte comme traité. */
export function noterNonFaitLocal(id: string, commentaire: string | null, traiteLe: string = new Date().toISOString()): void {
  const faits = new Set(etat.faits);
  faits.delete(id);
  changer({
    ...etat,
    faits,
    nonFaits: new Map(etat.nonFaits).set(id, { commentaire: commentaire?.trim() || null, traiteLe }),
    notes: sans(etat.notes, id),
  });
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
  changer(ETAT_VIDE);
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

export type ResultatEcriture = 'ok' | 'ok_sans_commentaire' | 'migration' | 'echec';

/** La base refuse une colonne du résultat d'arrêt : la migration 0012 n'est pas lancée. */
export function colonneResultatAbsente(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42703' || e.code === 'PGRST204' || /non_fait|traite_le|commentaire/i.test(e.message ?? '');
}

/**
 * Écrit le résultat d'un arrêt : Oui (fait, heure, commentaire facultatif) ou Non (non fait, heure, commentaire).
 * Migration 0012 pas lancée : Oui s'écrit comme avant, sans commentaire ('ok_sans_commentaire') ; Non rend 'migration'.
 */
export async function ecrireResultatArret(arretId: string, p: { fait: boolean; commentaire: string | null }): Promise<ResultatEcriture> {
  const client = getSupabase();
  if (!client) return 'echec';
  const maintenant = new Date().toISOString();
  const commentaire = p.commentaire?.trim() || null;
  const complet = p.fait
    ? { fait: true, fait_le: maintenant, non_fait: false, traite_le: maintenant, commentaire }
    : { fait: false, fait_le: null, non_fait: true, traite_le: maintenant, commentaire };
  try {
    const r = await avecDelai(client.from('arrets').update(complet).eq('id', arretId).select('id'));
    if (!r.error) return Array.isArray(r.data) && r.data.length > 0 ? 'ok' : 'echec';
    if (!colonneResultatAbsente(r.error)) return 'echec';
    if (!p.fait) return 'migration';
    const ancien = await avecDelai(
      client.from('arrets').update({ fait: true, fait_le: maintenant }).eq('id', arretId).select('id'),
    );
    return !ancien.error && Array.isArray(ancien.data) && ancien.data.length > 0 ? 'ok_sans_commentaire' : 'echec';
  } catch {
    return 'echec';
  }
}

export type StatutArret = 'fait' | 'non_fait' | null;

/** Le résultat d'un arrêt : ce que ce téléphone a noté passe avant ce que la base dit (correction d'un choix). */
export function statutArret(a: Arret, locaux: Pick<EtatTrajet, 'faits' | 'nonFaits'>): StatutArret {
  const id = idArret(a);
  if (locaux.nonFaits.has(id)) return 'non_fait';
  if (locaux.faits.has(id)) return 'fait';
  if (a.non_fait && !a.fait) return 'non_fait';
  return a.fait ? 'fait' : null;
}

/** Le commentaire de l'équipe sur un arrêt (ce téléphone d'abord, puis la base). */
export function commentaireArret(a: Arret, locaux: Pick<EtatTrajet, 'nonFaits' | 'notes'>): string | null {
  const id = idArret(a);
  return locaux.nonFaits.get(id)?.commentaire ?? locaux.notes.get(id) ?? a.commentaire ?? null;
}

/** « 3 arrêts traités sur 7, dont 1 non fait ». */
export function libelleAvancement(traites: number, total: number, nonFaits: number): string {
  const base = `${traites} ${traites > 1 ? 'arrêts traités' : 'arrêt traité'} sur ${total}`;
  return nonFaits > 0 ? `${base}, dont ${nonFaits} non fait${nonFaits > 1 ? 's' : ''}` : base;
}

/** La tournée est terminée quand tous ses arrêts sont traités (faits ou non faits) et qu'aucun n'est en échec partiel (les autres tournées ne comptent pas). */
export function tourneeTerminee(arrets: Arret[], estFait: (a: Arret) => boolean, estPartiel: (a: Arret) => boolean): boolean {
  return arrets.length > 0 && arrets.every(estFait) && !arrets.some(estPartiel);
}

/** Seul le compte de l'équipe publie la position de l'équipe, et seulement une fois le suivi démarré, en ligne et hors démonstration. */
export function peutPublierPosition(p: { suiviActif: boolean; compteDeLEquipe: boolean; local: boolean; demoHorsLigne: boolean; repli: boolean }): boolean {
  return p.suiviActif && p.compteDeLEquipe && !p.local && !p.demoHorsLigne && !p.repli;
}

/** Un arrêt n'est marqué fait que par un superviseur ou par le compte de l'équipe de la tournée (démonstration locale : libre). */
export function peutMarquerFait(p: { peutGerer: boolean; compteDeLEquipe: boolean; local: boolean }): boolean {
  return p.peutGerer || p.compteDeLEquipe || p.local;
}

/** Distance (m) en dessous de laquelle on est « à » un arrêt. */
export const RAYON_SUR_PLACE_M = 50;

/** Arrêt NON fait, autre que le prochain, où l'équipe se trouve (à moins de 50 m), le plus proche d'abord. */
export function arretSurPlace(position: Coordonnees | null, restants: Arret[], prochain: Arret | null): Arret | null {
  if (!position) return null;
  let meilleur: { a: Arret; d: number } | null = null;
  for (const a of restants) {
    if (prochain && idArret(a) === idArret(prochain)) continue;
    const d = distanceM(position, a.position);
    if (d < RAYON_SUR_PLACE_M && (!meilleur || d < meilleur.d)) meilleur = { a, d };
  }
  return meilleur?.a ?? null;
}

export const MESSAGE_POSITION_NON_PRISE = 'Position non prise en compte : départ au garage.';

/**
 * Résultat d'un recalcul « depuis ma position », une fois le nouveau plan lu : le départ est-il resté au garage ?
 * l'ordre a-t-il changé ? Rend le message à afficher.
 */
export function messageApresRecalcul(p: {
  departRecu: 'garage' | 'position' | undefined;
  prochainAvant: string | null;
  prochainApres: Arret | null;
}): string {
  if ((p.departRecu ?? 'garage') === 'garage') return MESSAGE_POSITION_NON_PRISE;
  if (!p.prochainApres) return 'Ordre recalculé depuis votre position : plus aucun arrêt à faire.';
  const change = idArret(p.prochainApres) !== p.prochainAvant;
  return change
    ? `Ordre recalculé depuis votre position : prochain arrêt ${p.prochainApres.rang}.`
    : `Ordre recalculé depuis votre position : le prochain arrêt reste le ${p.prochainApres.rang}.`;
}
