/**
 * Réglages du fond de carte. Les tuiles personnalisées sont COUPÉES par défaut : le fournisseur et ses
 * conditions d'usage doivent d'abord être validés. Pour un essai local seulement, on peut les activer
 * avec EXPO_PUBLIC_TUILES_ACTIVES=1 et EXPO_PUBLIC_TUILES_URL (modèle {z}/{x}/{y}) ; rien n'est écrit ici.
 */
export type ReglagesTuiles = {
  actif: boolean;
  modele: string;
  attribution: string;
};

type Env = Record<string, string | undefined>;

/**
 * Les variables EXPO_PUBLIC sont remplacées à la compilation SEULEMENT quand on écrit process.env.NOM en entier :
 * on les lit donc une par une ici (jamais par clé calculée ni en passant process.env en bloc).
 */
export function envCarte(): Env {
  return {
    EXPO_PUBLIC_CARTE_FOURNISSEUR: process.env.EXPO_PUBLIC_CARTE_FOURNISSEUR,
    EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR: process.env.EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR,
    EXPO_PUBLIC_GOOGLE_MAP_ID_SOMBRE: process.env.EXPO_PUBLIC_GOOGLE_MAP_ID_SOMBRE,
    EXPO_PUBLIC_GOOGLE_MAP_ID: process.env.EXPO_PUBLIC_GOOGLE_MAP_ID,
    EXPO_PUBLIC_TUILES_ACTIVES: process.env.EXPO_PUBLIC_TUILES_ACTIVES,
    EXPO_PUBLIC_TUILES_URL: process.env.EXPO_PUBLIC_TUILES_URL,
    EXPO_PUBLIC_TUILES_ATTRIBUTION: process.env.EXPO_PUBLIC_TUILES_ATTRIBUTION,
  };
}

export function lireReglagesTuiles(env: Env = envCarte()): ReglagesTuiles {
  const modele = env.EXPO_PUBLIC_TUILES_URL ?? '';
  const attribution = env.EXPO_PUBLIC_TUILES_ATTRIBUTION ?? '';
  // Sans modèle d'adresse ou sans attribution à afficher, on n'active jamais les tuiles.
  const actif = env.EXPO_PUBLIC_TUILES_ACTIVES === '1' && modele.includes('{z}') && attribution.length > 0;
  return { actif, modele, attribution };
}

export type FondCarte = {
  /** Fournisseur Google demandé ET possible (pas dans Expo Go, module natif Google présent). */
  google: boolean;
  /** Identifiant de style créé dans la console Google (facultatif). */
  idCarte?: string;
};

/**
 * Google Maps seulement si le réglage est actif (EXPO_PUBLIC_CARTE_FOURNISSEUR=google), si l'app n'est PAS dans
 * Expo Go (qui n'embarque que Apple Plans) et si le module natif Google est présent dans cette build.
 * Sinon on garde Apple Plans sobre. La clé n'est jamais lue ici : elle vit dans la configuration native.
 */
export function lireFondCarte(
  env: Env = envCarte(),
  options: { dansExpoGo: boolean; googleInstalle: boolean; theme?: 'light' | 'dark' },
): FondCarte {
  const demande = (env.EXPO_PUBLIC_CARTE_FOURNISSEUR ?? '').toLowerCase() === 'google';
  const google = demande && !options.dansExpoGo && options.googleInstalle;
  return { google, idCarte: google ? choisirIdCarte(env, options.theme ?? 'light') : undefined };
}

function propre(v: string | undefined): string | undefined {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : undefined;
}

/** Sombre : _SOMBRE, sinon _CLAIR ; clair : _CLAIR, sinon _SOMBRE ; puis l'ancien identifiant ; puis aucun. */
export function choisirIdCarte(env: Env, theme: 'light' | 'dark'): string | undefined {
  const clair = propre(env.EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR);
  const sombre = propre(env.EXPO_PUBLIC_GOOGLE_MAP_ID_SOMBRE);
  const ancien = propre(env.EXPO_PUBLIC_GOOGLE_MAP_ID);
  return (theme === 'dark' ? (sombre ?? clair) : (clair ?? sombre)) ?? ancien;
}
