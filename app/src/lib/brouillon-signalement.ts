import { useSyncExternalStore } from 'react';

import type { Categorie, Coordonnees } from '../types';

// Brouillon du signalement en cours, gardé en mémoire entre la carte et l'écran « signaler » : le retour depuis la photo
// rouvre la feuille des problèmes sur la carte, avec le problème et le lieu déjà choisis, sans perdre la photo ni le commentaire.

export type BrouillonSignalement = {
  /** Vrai quand la carte doit rouvrir la feuille « Quel problème avez-vous observé ? ». */
  feuilleOuverte: boolean;
  categorie: Categorie | null;
  lieu: Coordonnees | null;
  photoUri: string | null;
  photoVerifiee: boolean;
  commentaire: string;
};

/** Un brouillon plus vieux que ça est oublié (une alerte abandonnée ne revient pas des heures plus tard). */
export const DUREE_BROUILLON_MS = 30 * 60 * 1000;

const VIDE: BrouillonSignalement = {
  feuilleOuverte: false,
  categorie: null,
  lieu: null,
  photoUri: null,
  photoVerifiee: false,
  commentaire: '',
};

let brouillon: BrouillonSignalement = VIDE;
let misAJourLe = 0;
const ecouteurs = new Set<() => void>();

function perime(): boolean {
  return brouillon !== VIDE && Date.now() - misAJourLe > DUREE_BROUILLON_MS;
}

/** Le brouillon courant (vide s'il n'y en a pas ou s'il est périmé). La valeur ne change que lorsqu'on écrit. */
export function lireBrouillon(): BrouillonSignalement {
  return perime() ? VIDE : brouillon;
}

/** Met à jour une partie du brouillon. Ne notifie que si quelque chose change. */
export function ecrireBrouillon(champs: Partial<BrouillonSignalement>): void {
  const base = perime() ? VIDE : brouillon;
  const change = (Object.keys(champs) as (keyof BrouillonSignalement)[]).some((k) => {
    const a = base[k];
    const b = champs[k];
    if (k === 'lieu') {
      const x = a as Coordonnees | null;
      const y = b as Coordonnees | null | undefined;
      return (x?.latitude ?? null) !== (y?.latitude ?? null) || (x?.longitude ?? null) !== (y?.longitude ?? null);
    }
    return a !== b;
  });
  if (!change) return;
  brouillon = { ...base, ...champs };
  misAJourLe = Date.now();
  ecouteurs.forEach((f) => f());
}

/** Efface le brouillon (envoi réussi, abandon explicite). */
export function viderBrouillon(): void {
  if (brouillon === VIDE) return;
  brouillon = VIDE;
  misAJourLe = 0;
  ecouteurs.forEach((f) => f());
}

export function abonnerBrouillon(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

/** Le brouillon, avec redessin quand il change. */
export function useBrouillonSignalement(): BrouillonSignalement {
  return useSyncExternalStore(abonnerBrouillon, lireBrouillon, lireBrouillon);
}
