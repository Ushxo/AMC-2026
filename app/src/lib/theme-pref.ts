import { useSyncExternalStore } from 'react';

/** Style de la CARTE seulement (le fond de l'app suit toujours l'appareil). */
export type PreferenceTheme = 'auto' | 'clair' | 'sombre';

export const CLE_THEME = 'signalement-mtl:theme';
export const PREFERENCES: PreferenceTheme[] = ['auto', 'clair', 'sombre'];
export const LIBELLES_THEME: Record<PreferenceTheme, string> = {
  auto: 'Automatique',
  clair: 'Claire',
  sombre: 'Sombre',
};

let preference: PreferenceTheme = 'auto';
let chargee = false;
const ecouteurs = new Set<() => void>();

export function estPreference(v: unknown): v is PreferenceTheme {
  return v === 'auto' || v === 'clair' || v === 'sombre';
}

type Stockage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };

// Chargé au moment de l'usage : si le stockage de l'appareil est absent, on reste en « Automatique » sans planter.
function stockage(): Stockage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage');
  return (m.default ?? m) as Stockage;
}

function notifier(): void {
  ecouteurs.forEach((f) => f());
}

export function lirePreferenceTheme(): PreferenceTheme {
  return preference;
}

export async function definirPreferenceTheme(p: PreferenceTheme): Promise<void> {
  preference = p;
  chargee = true;
  notifier();
  try {
    await stockage().setItem(CLE_THEME, p);
  } catch {
    // Pas de stockage : le choix vaut pour cette session seulement.
  }
}

/** Relit le choix gardé, une seule fois. Une valeur absente ou inconnue donne « Automatique ». */
export async function chargerPreferenceTheme(): Promise<void> {
  if (chargee) return;
  chargee = true;
  try {
    const v = await stockage().getItem(CLE_THEME);
    if (estPreference(v) && v !== preference) {
      preference = v;
      notifier();
    }
  } catch {
    // Illisible : « Automatique ».
  }
}

export function reinitialiserThemePourTests(): void {
  preference = 'auto';
  chargee = false;
  notifier();
}

function abonner(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

export function usePreferenceTheme(): PreferenceTheme {
  return useSyncExternalStore(abonner, lirePreferenceTheme, lirePreferenceTheme);
}
