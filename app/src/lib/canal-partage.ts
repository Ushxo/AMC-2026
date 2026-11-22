import { getSupabase } from './supabase';

// Un seul canal Realtime par table, partagé par tous les abonnés. Il s'ouvre au premier abonné et se ferme au dernier.
// Les événements rapprochés sont regroupés : une relecture au plus toutes les 300 ms.

export const REGROUPEMENT_MS = 300;

type Entree = {
  canal: unknown;
  client: NonNullable<ReturnType<typeof getSupabase>>;
  rappels: Set<() => void>;
  statuts: Set<() => void>;
  connecte: boolean;
  dejaConnecte: boolean;
  minuteur: ReturnType<typeof setTimeout> | null;
  dernierAppel: number;
};

const entrees = new Map<string, Entree>();

function appeler(entree: Entree): void {
  entree.minuteur = null;
  entree.dernierAppel = Date.now();
  [...entree.rappels].forEach((f) => f());
}

function evenement(entree: Entree): void {
  if (entree.minuteur) return; // une relecture est déjà prévue
  const attente = REGROUPEMENT_MS - (Date.now() - entree.dernierAppel);
  if (attente <= 0) appeler(entree);
  else entree.minuteur = setTimeout(() => appeler(entree), attente);
}

function definirConnecte(entree: Entree, valeur: boolean): void {
  if (entree.connecte === valeur) return;
  entree.connecte = valeur;
  const retour = valeur && entree.dejaConnecte; // reconnexion : on rattrape ce qui a pu être manqué
  if (valeur) entree.dejaConnecte = true;
  entree.statuts.forEach((f) => f());
  if (retour) evenement(entree);
}

/** Réveille `rappel` à chaque changement de la table (Realtime partagé). Rend la fonction d'arrêt. */
export function abonnerTable(table: string, rappel: () => void): () => void {
  let entree = entrees.get(table);
  if (!entree) {
    const client = getSupabase();
    if (!client) return () => {};
    try {
      const nouvelle: Entree = {
        canal: null,
        client,
        rappels: new Set(),
        statuts: new Set(),
        connecte: false,
        dejaConnecte: false,
        minuteur: null,
        dernierAppel: 0,
      };
      nouvelle.canal = client
        .channel(`${table}-partage-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => evenement(nouvelle))
        .subscribe((statut: string) => definirConnecte(nouvelle, statut === 'SUBSCRIBED'));
      entree = nouvelle;
      entrees.set(table, entree);
    } catch {
      return () => {};
    }
  }
  const courante = entree;
  courante.rappels.add(rappel);
  let actif = true;
  return () => {
    if (!actif) return;
    actif = false;
    courante.rappels.delete(rappel);
    if (courante.rappels.size > 0) return;
    if (courante.minuteur) clearTimeout(courante.minuteur);
    courante.minuteur = null;
    if (entrees.get(table) === courante) entrees.delete(table);
    try {
      void courante.client.removeChannel(courante.canal as Parameters<typeof courante.client.removeChannel>[0]);
    } catch {
      // canal déjà fermé : rien à faire
    }
  };
}

/** Vrai quand le canal de cette table est ouvert et reçoit les changements. */
export function canalConnecte(table: string): boolean {
  return entrees.get(table)?.connecte ?? false;
}

/** Réveille `f` quand le canal de cette table se connecte ou se coupe. */
export function abonnerStatutCanal(table: string, f: () => void): () => void {
  const entree = entrees.get(table);
  if (!entree) return () => {};
  entree.statuts.add(f);
  return () => {
    entree.statuts.delete(f);
  };
}

/** Nombre de canaux ouverts (pour les tests et les mesures). */
export function nombreCanauxOuverts(): number {
  return entrees.size;
}

export function reinitialiserCanaux(): void {
  entrees.forEach((e) => {
    if (e.minuteur) clearTimeout(e.minuteur);
  });
  entrees.clear();
}
