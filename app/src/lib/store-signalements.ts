import type { Signalement } from '../types';
import { RAFRAICHISSEMENT_MS, SONDE_REPLI_MS } from './config';
import { lister, type ElementFile } from './file-attente';
import { MESSAGE_LECTURE_ECHEC } from './messages';
import { demarrerReleve } from './releve';
import {
  abonnerChangements,
  abonnerSignalementsRealtime,
  etatSource,
  lireSignalements,
  renvoyerFile,
  sonderSource,
} from './source';

// Magasin partagé des signalements : une seule lecture à la fois, un seul abonnement Realtime et un seul jeu de
// minuteurs tant qu'au moins un écran écoute. Le cache est rendu tout de suite, la relecture se fait en arrière-plan.

export type EtatSignalements = { tous: Signalement[]; chargement: boolean; erreur: string | null };

/** Au-delà de ce délai, un nouvel écran déclenche une relecture en arrière-plan (sinon le cache suffit). */
export const CACHE_FRAIS_MS = 3000;
const PASSES_MAX = 3;

const ETAT_INITIAL: EtatSignalements = { tous: [], chargement: true, erreur: null };
let etat: EtatSignalements = ETAT_INITIAL;
let derniereLecture = 0;
let enCours: Promise<void> | null = null;
let relance = false;
let depart: ReturnType<typeof setTimeout> | null = null;
let arreterBoucles: (() => void) | null = null;
const ecouteurs = new Set<() => void>();

/** Mêmes signalements (identifiants, états, gravités, positions) : la liste précédente est gardée, rien ne se recalcule. */
export function memesSignalements(a: Signalement[], b: Signalement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.etat !== y.etat ||
      x.gravite !== y.gravite ||
      x.categorie !== y.categorie ||
      x.latitude !== y.latitude ||
      x.longitude !== y.longitude ||
      x.etat_change_le !== y.etat_change_le ||
      x.commentaire !== y.commentaire ||
      x.photo_url !== y.photo_url ||
      Boolean(x.en_attente) !== Boolean(y.en_attente) ||
      x.echec_envoi !== y.echec_envoi
    )
      return false;
  }
  return true;
}

function publier(suivant: EtatSignalements): void {
  if (suivant.tous === etat.tous && suivant.chargement === etat.chargement && suivant.erreur === etat.erreur) return;
  etat = suivant;
  ecouteurs.forEach((f) => f());
}

export function lireEtatSignalements(): EtatSignalements {
  return etat;
}

let renvoiLance = false;

/** Renvoi de la file en arrière-plan : ne bloque jamais l'affichage. Un seul à la fois ; une relecture légère s'il a réussi. */
function renvoyerEnArrierePlan(): void {
  if (renvoiLance) return;
  renvoiLance = true;
  void Promise.resolve()
    .then(() => renvoyerFile())
    .then((envoyes) => {
      if (envoyes > 0) void rafraichirSignalements();
    })
    .catch(() => {}) // la file reste sur le téléphone, le prochain passage réessaie
    .finally(() => {
      renvoiLance = false;
    });
}

async function lireUneFois(): Promise<void> {
  try {
    renvoyerEnArrierePlan();
    const file: ElementFile[] = await lister().catch(() => []); // file illisible : on n'y touche pas
    const lus = await lireSignalements();
    const ids = new Set(lus.map((s) => s.id));
    const attente = file
      .filter((e) => !ids.has(e.signalement.id))
      .map((e) => ({
        ...e.signalement,
        en_attente: true as const,
        ...(e.echec ? { echec_envoi: e.echec } : {}),
      }));
    const suivants = [...attente, ...lus];
    derniereLecture = Date.now();
    publier({ tous: memesSignalements(etat.tous, suivants) ? etat.tous : suivants, chargement: false, erreur: null });
  } catch {
    publier({ ...etat, chargement: false, erreur: MESSAGE_LECTURE_ECHEC });
  }
}

/**
 * Relit les signalements. Une seule lecture à la fois, partagée : un appel pendant une lecture rend la même promesse.
 * Un changement reçu pendant la lecture déclenche une seule relecture de rattrapage ensuite.
 */
export function rafraichirSignalements(): Promise<void> {
  if (enCours) {
    relance = true;
    return enCours;
  }
  enCours = (async () => {
    let passes = 0;
    do {
      relance = false;
      passes++;
      await lireUneFois();
    } while (relance && passes < PASSES_MAX);
  })().finally(() => {
    enCours = null;
    relance = false;
  });
  return enCours;
}

function lireSiPerime(): void {
  if (depart) return;
  depart = setTimeout(() => {
    depart = null;
    if (etat.chargement || Date.now() - derniereLecture > CACHE_FRAIS_MS) void rafraichirSignalements();
  }, 0);
}

function demarrer(): void {
  lireSiPerime();
  const arretLocal = abonnerChangements(() => void rafraichirSignalements());
  // Realtime : relecture dès qu'un signalement change ; la relève (lente si le canal est connecté) reste le repli.
  const arretRealtime = abonnerSignalementsRealtime(() => void rafraichirSignalements());
  // Hors ligne : on sonde la connexion, et le renvoi de la file repart dès son retour.
  const arretReleve = demarrerReleve({
    table: 'signalements',
    lentMs: RAFRAICHISSEMENT_MS,
    rapideMs: SONDE_REPLI_MS,
    lire: () => {
      if (etatSource() === 'repli') {
        void sonderSource().then((e) => {
          if (e === 'en_ligne') void rafraichirSignalements();
        });
      } else {
        void rafraichirSignalements();
      }
    },
  });
  arreterBoucles = () => {
    arretLocal();
    arretRealtime();
    arretReleve();
  };
}

function arreter(): void {
  if (depart) clearTimeout(depart);
  depart = null;
  arreterBoucles?.();
  arreterBoucles = null;
}

/** Écoute le magasin. Le premier abonné lance les minuteurs et le canal ; le dernier qui part les arrête (le cache reste). */
export function abonnerSignalements(f: () => void): () => void {
  ecouteurs.add(f);
  if (ecouteurs.size === 1) demarrer();
  else lireSiPerime();
  return () => {
    ecouteurs.delete(f);
    if (ecouteurs.size === 0) arreter();
  };
}

/** Nombre d'écrans qui écoutent (tests et mesures). */
export function nombreAbonnesSignalements(): number {
  return ecouteurs.size;
}

export function reinitialiserStoreSignalements(): void {
  arreter();
  ecouteurs.clear();
  etat = ETAT_INITIAL;
  derniereLecture = 0;
  renvoiLance = false;
  enCours = null;
  relance = false;
}
