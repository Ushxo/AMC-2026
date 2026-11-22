import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Signalement } from '../types';
import { CLE_FILE } from './config';

export type ElementFile = {
  signalement: Signalement;
  photoUri?: string;
  /** Motif lisible quand l'envoi est refusé pour de bon. L'élément reste en file, sans nouvel essai. */
  echec?: string;
};

// Toutes les opérations passent l'une après l'autre : pas de lecture-écriture qui s'écrasent.
let chaine: Promise<unknown> = Promise.resolve();

function enSerie<T>(operation: () => Promise<T>): Promise<T> {
  const resultat = chaine.then(operation);
  chaine = resultat.catch(() => undefined);
  return resultat;
}

/** Lit la file. Une valeur illisible lève une erreur : on ne la remplace jamais par une liste vide. */
async function lire(): Promise<ElementFile[]> {
  const brut = await AsyncStorage.getItem(CLE_FILE);
  if (brut === null) return [];
  const v: unknown = JSON.parse(brut);
  if (!Array.isArray(v)) throw new Error('File en attente illisible');
  return v as ElementFile[];
}

async function ecrire(liste: ElementFile[]): Promise<void> {
  await AsyncStorage.setItem(CLE_FILE, JSON.stringify(liste));
}

export function lister(): Promise<ElementFile[]> {
  return enSerie(lire);
}

export function ajouter(el: ElementFile): Promise<void> {
  return enSerie(async () => {
    const liste = await lire();
    if (liste.some((x) => x.signalement.id === el.signalement.id)) return;
    await ecrire([...liste, el]);
  });
}

export function retirer(id: string): Promise<void> {
  return enSerie(async () => {
    const liste = await lire();
    await ecrire(liste.filter((x) => x.signalement.id !== id));
  });
}

/** Garde l'élément avec le motif du refus. */
export function marquerEchec(id: string, motif: string): Promise<void> {
  return enSerie(async () => {
    const liste = await lire();
    await ecrire(liste.map((x) => (x.signalement.id === id ? { ...x, echec: motif } : x)));
  });
}

export function vider(): Promise<void> {
  return enSerie(() => AsyncStorage.removeItem(CLE_FILE));
}
