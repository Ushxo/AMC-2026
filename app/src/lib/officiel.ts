import type {
  CoucheAvisEau,
  CoucheChantiers,
  CoucheGrilles,
  CoucheZonesInondables,
  Couches,
  Coordonnees,
  Signalement,
} from '../types';
import type { Region } from './config';
import { REGION_DEMO } from './config';

export type EntreeAdresse = { libelle: string; latitude: number; longitude: number };

export type MetaDonnees = {
  copieDu: string;
  quartier: string;
  region: Region;
  sources: { nom: string; identifiant: string; lignes: number }[];
  avisPlaces: { geometrie_source: number; adresse: number; aucun: number };
};

export type SourcesBrutes = {
  grilles?: unknown;
  avisEau?: unknown;
  chantiers?: unknown;
  zonesInondables?: unknown;
  meta?: unknown;
};

function collectionVide<T>(): T {
  return { type: 'FeatureCollection', features: [] } as unknown as T;
}

function estCollection(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === 'FeatureCollection' &&
    Array.isArray((v as { features?: unknown }).features)
  );
}

function ouVide<T>(v: unknown): T {
  return estCollection(v) ? (v as T) : collectionVide<T>();
}

/** Assemble les couches. Une couche absente ou invalide devient une collection vide. */
export function assemblerCouches(s: SourcesBrutes): Couches {
  const meta = s.meta as Partial<MetaDonnees> | undefined;
  return {
    grilles: ouVide<CoucheGrilles>(s.grilles),
    avisEau: ouVide<CoucheAvisEau>(s.avisEau),
    chantiers: ouVide<CoucheChantiers>(s.chantiers),
    zonesInondables: ouVide<CoucheZonesInondables>(s.zonesInondables),
    copieDu: typeof meta?.copieDu === 'string' ? meta.copieDu : '',
  };
}

function essayer<T>(charger: () => T): T | undefined {
  try {
    return charger();
  } catch {
    return undefined;
  }
}

function brutes(): SourcesBrutes {
  return {
    grilles: essayer(() => require('../donnees/grilles.json')),
    avisEau: essayer(() => require('../donnees/avis-eau.json')),
    chantiers: essayer(() => require('../donnees/chantiers.json')),
    zonesInondables: essayer(() => require('../donnees/zones-inondables.json')),
    meta: essayer(() => require('../donnees/meta.json')),
  };
}

let cache: Couches | null = null;

export function chargerCouches(): Couches {
  if (!cache) cache = assemblerCouches(brutes());
  return cache;
}

export function chargerAdresses(): EntreeAdresse[] {
  const v = essayer(() => require('../donnees/adresses.json'));
  return Array.isArray(v) ? (v as EntreeAdresse[]) : [];
}

export type RegardEgout = { id: string; latitude: number; longitude: number; adresse?: string | null };

let cacheRegards: RegardEgout[] | null = null;

/** Regards d'égout réels du quartier (copie locale). Liste vide si le fichier manque ou est invalide. */
export function chargerRegards(): RegardEgout[] {
  if (cacheRegards) return cacheRegards;
  const v = essayer(() => require('../donnees/regards.json'));
  cacheRegards = Array.isArray(v)
    ? (v as RegardEgout[]).filter(
        (r) => r && r.id !== undefined && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)),
      )
    : [];
  return cacheRegards;
}

export function chargerSignalementsDemo(): Signalement[] {
  const v = essayer(() => require('../donnees/signalements-demo.json'));
  if (!Array.isArray(v)) return [];
  return (v as Signalement[]).map((s) => ({ ...s, origine: 'citoyen' as const }));
}

export function chargerRegion(): Region {
  return REGION_DEMO;
}

export function centreRegion(r: Region): Coordonnees {
  return { latitude: r.latitude, longitude: r.longitude };
}
