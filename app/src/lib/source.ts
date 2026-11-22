import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type {
  Categorie,
  ChangementEtat,
  Employe,
  Etat,
  EtatSource,
  Gravite,
  Signalement,
} from '../types';
import { BUCKET_PHOTOS, CLE_ETATS_DEMO, DELAI_SUPABASE_MS } from './config';
import { analyserErreurEnvoi } from './erreurs-envoi';
import { ajouter, lister, marquerEchec, retirer, type ElementFile } from './file-attente';
import {
  MESSAGE_CHANGEMENT_ECHEC,
  MESSAGE_CHANGEMENT_HORS_LIGNE,
  MESSAGE_CHANGEMENT_REFUSE,
  MESSAGE_FILE_ILLISIBLE,
  MESSAGE_SESSION_REQUISE,
} from './messages';
import { chargerSignalementsDemo } from './officiel';
import { urlPhotoDuBucket } from './photo';
import { copierPhotoDurable, supprimerPhotoDurable } from './photo-locale';
import { employeCourant, estEmployeDemo } from './session';
import { getSupabase } from './supabase';
import { uuidV4 } from './uuid';

const DELAI_ENVOI_MS = 20000;
const COLONNES = [
  'id',
  'latitude',
  'longitude',
  'categorie',
  'gravite',
  'commentaire',
  'photo_url',
  'grille_id',
] as const;

// --- État de la source et abonnements ---

let etat: EtatSource = getSupabase() ? 'en_ligne' : 'repli';
const ecouteursEtat = new Set<() => void>();
const ecouteursChangements = new Set<() => void>();

export function etatSource(): EtatSource {
  return etat;
}

function definirEtat(e: EtatSource): void {
  if (e === etat) return;
  etat = e;
  ecouteursEtat.forEach((f) => f());
}

export function abonnerEtat(f: () => void): () => void {
  ecouteursEtat.add(f);
  return () => {
    ecouteursEtat.delete(f);
  };
}

export function abonnerChangements(f: () => void): () => void {
  ecouteursChangements.add(f);
  return () => {
    ecouteursChangements.delete(f);
  };
}

function notifier(): void {
  ecouteursChangements.forEach((f) => f());
}

export function avecDelai<T>(p: PromiseLike<T>, ms: number = DELAI_SUPABASE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('delai')), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// --- Modifications locales (démonstration hors ligne), gardées dans AsyncStorage ---

const changementsLocaux = new Map<string, { etat: Etat; le: string }>();
let historiqueLocal: ChangementEtat[] = [];
let localCharge = false;

async function chargerLocal(): Promise<void> {
  if (localCharge) return;
  localCharge = true;
  try {
    const brut = await AsyncStorage.getItem(CLE_ETATS_DEMO);
    if (!brut) return;
    const v = JSON.parse(brut) as {
      changements?: Record<string, { etat: Etat; le: string }>;
      historique?: ChangementEtat[];
    };
    for (const [id, c] of Object.entries(v.changements ?? {})) changementsLocaux.set(id, c);
    if (Array.isArray(v.historique)) historiqueLocal = v.historique;
  } catch {
    // Données locales illisibles : on repart de la copie d'origine.
  }
}

async function sauverLocal(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CLE_ETATS_DEMO,
      JSON.stringify({ changements: Object.fromEntries(changementsLocaux), historique: historiqueLocal }),
    );
  } catch {
    // Le changement reste en mémoire pour cette session.
  }
}

/** Remet la démonstration à zéro (mémoire et AsyncStorage). */
export async function reinitialiserLocal(): Promise<void> {
  changementsLocaux.clear();
  historiqueLocal = [];
  localCharge = true;
  try {
    await AsyncStorage.removeItem(CLE_ETATS_DEMO);
  } catch {
    // Rien à effacer.
  }
}

/** Oublie la mémoire sans toucher au stockage : comme un redémarrage de l'app. */
export function redemarrerLocal(): void {
  changementsLocaux.clear();
  historiqueLocal = [];
  localCharge = false;
}

async function appliquerLocalSiDemo(liste: Signalement[]): Promise<Signalement[]> {
  if (!estEmployeDemo(employeCourant())) return liste;
  await chargerLocal();
  return liste.map((s) => {
    const c = changementsLocaux.get(s.id);
    return c ? { ...s, etat: c.etat, etat_change_le: c.le } : s;
  });
}

async function signalementsRepli(): Promise<Signalement[]> {
  await chargerLocal();
  return chargerSignalementsDemo().map((s) => {
    const c = changementsLocaux.get(s.id);
    return c ? { ...s, etat: c.etat, etat_change_le: c.le } : s;
  });
}

// --- Lecture ---

function versSignalement(ligne: Record<string, unknown>): Signalement {
  return {
    id: ligne.id as string,
    origine: 'citoyen',
    cree_le: ligne.cree_le as string,
    latitude: Number(ligne.latitude),
    longitude: Number(ligne.longitude),
    categorie: ligne.categorie as Categorie,
    gravite: ligne.gravite as Gravite,
    commentaire: (ligne.commentaire as string | null) ?? null,
    photo_url: (ligne.photo_url as string | null) ?? null,
    grille_id: (ligne.grille_id as string | null) ?? null,
    etat: ligne.etat as Etat,
    etat_change_le: ligne.etat_change_le as string,
    exemple_demo: Boolean(ligne.exemple_demo),
  };
}

export async function lireSignalements(): Promise<Signalement[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await avecDelai(
        client.from('signalements').select('*').order('cree_le', { ascending: false }).limit(2000),
      );
      if (error) throw error;
      definirEtat('en_ligne');
      return await appliquerLocalSiDemo((data ?? []).map((l) => versSignalement(l as Record<string, unknown>)));
    } catch {
      definirEtat('repli');
    }
  } else {
    definirEtat('repli');
  }
  return await signalementsRepli();
}

/** Teste la connexion et met à jour l'état de la source. */
export async function sonderSource(): Promise<EtatSource> {
  const client = getSupabase();
  if (!client) {
    definirEtat('repli');
    return etat;
  }
  try {
    const { error } = await avecDelai(client.from('signalements').select('id').limit(1));
    definirEtat(error ? 'repli' : 'en_ligne');
  } catch {
    definirEtat('repli');
  }
  return etat;
}

// --- Création et file d'attente ---

export type DonneesSignalement = {
  latitude: number;
  longitude: number;
  categorie: Categorie;
  gravite: Gravite;
  commentaire?: string;
  photoUri?: string;
  grille_id: string | null;
};

export type ResultatCreation =
  | { statut: 'envoye' | 'en_attente'; signalement: Signalement; sansPhoto?: boolean }
  | { statut: 'echec'; message: string };

async function reduirePhoto(uri: string): Promise<string> {
  try {
    const r = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    return r.uri;
  } catch {
    return uri;
  }
}

type Client = NonNullable<ReturnType<typeof getSupabase>>;

async function envoyerElement(
  client: Client,
  el: ElementFile,
): Promise<{ signalement: Signalement; sansPhoto: boolean }> {
  const s = el.signalement;
  let photo_url = s.photo_url;
  let sansPhoto = false;
  if (el.photoUri && !photo_url) {
    let contenu: ArrayBuffer | null = null;
    try {
      contenu = await (await fetch(el.photoUri)).arrayBuffer();
    } catch {
      contenu = null;
    }
    if (!contenu) {
      sansPhoto = true; // fichier introuvable : envoi sans photo, signalé à l'appelant
    } else {
      const chemin = `${s.id}.jpg`;
      const { error } = await avecDelai(
        client.storage.from(BUCKET_PHOTOS).upload(chemin, contenu, { contentType: 'image/jpeg' }),
        DELAI_ENVOI_MS,
      );
      if (error && !/exist|duplicate/i.test(error.message)) throw error;
      photo_url = urlPhotoDuBucket(chemin);
      if (!photo_url) throw new Error('Adresse du projet manquante');
    }
  }
  const final: Signalement = { ...s, photo_url };
  const ligne = Object.fromEntries(COLONNES.map((c) => [c, final[c]]));
  const { error } = await avecDelai(client.from('signalements').insert(ligne), DELAI_ENVOI_MS);
  if (error && (error as { code?: string }).code !== '23505') throw error;
  return { signalement: final, sansPhoto };
}

export async function creerSignalement(d: DonneesSignalement): Promise<ResultatCreation> {
  const maintenant = new Date().toISOString();
  const signalement: Signalement = {
    id: uuidV4(),
    origine: 'citoyen',
    cree_le: maintenant,
    latitude: d.latitude,
    longitude: d.longitude,
    categorie: d.categorie,
    gravite: d.gravite,
    commentaire: d.commentaire ? d.commentaire : null,
    photo_url: null,
    grille_id: d.grille_id,
    etat: 'nouveau',
    etat_change_le: maintenant,
    exemple_demo: false,
  };
  let photoUri: string | undefined;
  if (d.photoUri) {
    const reduite = await reduirePhoto(d.photoUri);
    // Copie dans le dossier durable de l'app : la photo survit au nettoyage du cache.
    photoUri = (await copierPhotoDurable(reduite, signalement.id)) ?? reduite;
  }
  const element: ElementFile = { signalement, photoUri };
  const client = getSupabase();
  if (client) {
    try {
      const envoye = await envoyerElement(client, element);
      definirEtat('en_ligne');
      if (photoUri) supprimerPhotoDurable(photoUri);
      notifier();
      return {
        statut: 'envoye',
        signalement: envoye.signalement,
        ...(envoye.sansPhoto ? { sansPhoto: true } : {}),
      };
    } catch (e) {
      const a = analyserErreurEnvoi(e);
      if (a.permanent) element.echec = a.motif;
      else definirEtat('repli');
    }
  } else {
    definirEtat('repli');
  }
  try {
    await ajouter(element);
  } catch {
    return { statut: 'echec', message: MESSAGE_FILE_ILLISIBLE };
  }
  notifier();
  return {
    statut: 'en_attente',
    signalement: {
      ...signalement,
      en_attente: true,
      ...(element.echec ? { echec_envoi: element.echec } : {}),
    },
  };
}

let renvoiEnCours = false;

/**
 * Renvoie la file au retour du réseau. Un même signalement ne part qu'une fois.
 * Un refus permanent est gardé avec son motif et n'arrête pas les suivants.
 */
export async function renvoyerFile(): Promise<number> {
  const client = getSupabase();
  if (!client || renvoiEnCours) return 0;
  renvoiEnCours = true;
  let envoyes = 0;
  let change = false;
  try {
    let elements: ElementFile[];
    try {
      elements = await lister();
    } catch {
      return 0; // file illisible : on n'y touche pas
    }
    for (const el of elements) {
      if (el.echec) continue;
      try {
        await envoyerElement(client, el);
        await retirer(el.signalement.id);
        if (el.photoUri) supprimerPhotoDurable(el.photoUri);
        envoyes += 1;
        change = true;
        definirEtat('en_ligne');
      } catch (e) {
        const a = analyserErreurEnvoi(e);
        if (a.permanent) {
          try {
            await marquerEchec(el.signalement.id, a.motif);
            change = true;
          } catch {
            // Le stockage local ne répond pas : on réessaiera.
          }
          continue;
        }
        definirEtat('repli');
        break;
      }
    }
  } finally {
    renvoiEnCours = false;
  }
  if (change) notifier();
  return envoyes;
}

// --- Traitement par la Ville ---

export async function changerEtat(id: string, nouvelEtat: Etat): Promise<string | null> {
  const employe: Employe | null = employeCourant();
  if (!employe) return MESSAGE_SESSION_REQUISE;
  if (!estEmployeDemo(employe)) {
    // Compte réel : le changement part vers Supabase, jamais vers le téléphone.
    const client = getSupabase();
    if (!client) return MESSAGE_CHANGEMENT_HORS_LIGNE;
    try {
      const { data, error } = await avecDelai(
        client.from('signalements').update({ etat: nouvelEtat }).eq('id', id).select('id'),
      );
      if (error) return MESSAGE_CHANGEMENT_ECHEC;
      if (!data || data.length === 0) return MESSAGE_CHANGEMENT_REFUSE;
      definirEtat('en_ligne');
      notifier();
      return null;
    } catch {
      definirEtat('repli');
      return MESSAGE_CHANGEMENT_HORS_LIGNE;
    }
  }
  // Démonstration hors ligne : le changement reste sur le téléphone, même si le réseau revient.
  const actuel = (await signalementsRepli()).find((s) => s.id === id);
  if (!actuel) return MESSAGE_CHANGEMENT_ECHEC;
  const le = new Date().toISOString();
  historiqueLocal = [
    ...historiqueLocal,
    {
      id: uuidV4(),
      signalement_id: id,
      ancien_etat: actuel.etat,
      nouvel_etat: nouvelEtat,
      change_le: le,
      change_par: employe.user_id,
    },
  ];
  changementsLocaux.set(id, { etat: nouvelEtat, le });
  await sauverLocal();
  notifier();
  return null;
}

export async function lireHistorique(id: string): Promise<ChangementEtat[]> {
  if (estEmployeDemo(employeCourant())) {
    await chargerLocal();
    return historiqueLocal.filter((h) => h.signalement_id === id);
  }
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await avecDelai(
      client
        .from('historique_etats')
        .select('*')
        .eq('signalement_id', id)
        .order('change_le', { ascending: true }),
    );
    if (!error) return (data ?? []) as ChangementEtat[];
  } catch {
    definirEtat('repli');
  }
  return [];
}

/** Réveille `rappel` à chaque changement des signalements (Realtime). Rend la fonction d'arrêt. */
export function abonnerSignalementsRealtime(rappel: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};
  try {
    const canal = client
      .channel(`signalements-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signalements' }, rappel)
      .subscribe();
    return () => {
      void client.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}
