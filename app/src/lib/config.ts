export const SEUIL_MOYENNE = 20;
export const SEUIL_ELEVEE = 50;
/** Signalements ouverts qu'il faut au même endroit pour qu'il apparaisse, sans photo vérifiée. */
export const SEUIL_SANS_PHOTO = 3;
/** Avec une photo vérifiée, un seul signalement suffit. */
export const SEUIL_AVEC_PHOTO = 1;
export const PAS_CASE = 0.0005;
export const RAYON_GRILLE_M = 25;
export const RAYON_AVIS_POINT_M = 150;
export const DELAI_SUPABASE_MS = 5000;
export const RAFRAICHISSEMENT_MS = 30000;
export const BUCKET_PHOTOS = 'photos-signalements';
export const SONDE_REPLI_MS = 10000;
export const CLE_FILE = 'signalement-mtl:file';
export const CLE_ETATS_DEMO = 'signalement-mtl:etats-demo';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const REGION_PAR_DEFAUT: Region = {
  latitude: 45.5025,
  longitude: -73.5675,
  latitudeDelta: 0.03,
  longitudeDelta: 0.042,
};

function regionDesDonnees(): Region {
  try {
    const m = require('../donnees/meta.json') as { region?: Region };
    const r = m.region;
    if (r && [r.latitude, r.longitude, r.latitudeDelta, r.longitudeDelta].every(Number.isFinite)) return r;
  } catch {
    // Pas de copie locale : région par défaut.
  }
  return REGION_PAR_DEFAUT;
}

// Quartier de démo : la région vient de la copie locale (meta.json).
export const REGION_DEMO: Region = regionDesDonnees();

export const BOITE_MONTREAL = {
  latMin: 45.4,
  latMax: 45.71,
  lngMin: -73.98,
  lngMax: -73.47,
};
