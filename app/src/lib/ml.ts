// Appel du serveur de ML qui juge la photo d'un égout.
//
//   const resultat = await jugerPhoto(photo.uri);   // uri d'expo-image-picker ou expo-camera
//   if (!resultat.valide) → demander une autre photo
//   else → resultat.score_gravite (0-100) pour classer le signalement
//
// L'adresse du serveur vient de EXPO_PUBLIC_ML_URL (app/.env) :
//   - en local : http://IP_DU_PC:8000 (téléphone sur le même wifi)
//   - en ligne : l'adresse Cloud Run, https://egouts-ml-xxxx.a.run.app

import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type Gravite = 'faible' | 'moyenne' | 'elevee';

export type ResultatPhoto = {
  /** La photo montre bien un égout ou une grille. */
  valide: boolean;
  /** Chances que la photo soit valide, en %. */
  probabilite_valide: number;
  /** Gravité de 0 (rien à signaler) à 100 (urgent) ; null si la photo est invalide. */
  score_gravite: number | null;
  gravite: Gravite | null;
  /** Détail par classe, en %. */
  probabilites: Record<'invalide' | Gravite, number>;
};

export class ErreurML extends Error {
  constructor(message: string, readonly statut?: number) {
    super(message);
    this.name = 'ErreurML';
  }
}

const URL_ML = process.env.EXPO_PUBLIC_ML_URL?.replace(/\/$/, '');

function adresse(chemin: string): string {
  if (!URL_ML) {
    throw new ErreurML('EXPO_PUBLIC_ML_URL manque dans app/.env : relancer Expo après l’avoir ajouté.');
  }
  return URL_ML + chemin;
}

/**
 * Fichier local → partie de formulaire.
 * Le fetch d'Expo (qui remplace celui de React Native) n'accepte pas l'ancien
 * format `{ uri, name, type }` : il faut un Blob. Sur mobile, le File
 * d'expo-file-system en est un ; sur le web, l'uri est déjà lisible par fetch.
 */
async function lireFichier(uri: string): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  return new File(uri) as unknown as Blob;
}

export async function jugerPhoto(uri: string): Promise<ResultatPhoto> {
  const url = adresse('/juger'); // hors du try : l'erreur « adresse manquante » doit remonter telle quelle

  const formulaire = new FormData();
  try {
    formulaire.append('photo', await lireFichier(uri), 'photo.jpg');
  } catch (e) {
    console.warn('[ml] lecture de la photo impossible', e);
    throw new ErreurML('Impossible de lire la photo sur le téléphone.');
  }

  let reponse: Response;
  try {
    reponse = await fetch(url, { method: 'POST', body: formulaire });
  } catch (e) {
    console.warn('[ml] envoi de la photo échoué', e);
    throw new ErreurML('Serveur d’analyse injoignable. Vérifie ta connexion.');
  }
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => null);
    throw new ErreurML(corps?.detail ?? 'Analyse de la photo impossible.', reponse.status);
  }
  return reponse.json();
}

/** Réveille le serveur (Cloud Run s'endort quand personne ne l'utilise). */
export async function reveillerServeurML(): Promise<boolean> {
  try {
    return (await fetch(adresse('/sante'))).ok;
  } catch {
    return false;
  }
}
