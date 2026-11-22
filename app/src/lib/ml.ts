// Appel du serveur de ML qui juge la photo d'un égout.
//
//   const resultat = await jugerPhoto(photo.uri);   // uri d'expo-image-picker ou expo-camera
//   if (!resultat.valide) → demander une autre photo
//   else → resultat.score_gravite (0-100) pour classer le signalement
//

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

// La photo passe par la fonction serveur « juger-photo » : la clé du service d'analyse reste
// côté serveur et n'est jamais dans l'app.
const URL_SERVEUR = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/(rest\/v1)?\/?$/, '');
const CLE_PUBLIQUE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function adresse(): string {
  if (!URL_SERVEUR) {
    throw new ErreurML('EXPO_PUBLIC_SUPABASE_URL manque dans app/.env.local : relancer Expo après l’avoir ajouté.');
  }
  return URL_SERVEUR + '/functions/v1/juger-photo';
}

function enTetes(): Record<string, string> | undefined {
  return CLE_PUBLIQUE ? { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${CLE_PUBLIQUE}` } : undefined;
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
  const url = adresse(); // hors du try : l'erreur « adresse manquante » doit remonter telle quelle

  const formulaire = new FormData();
  try {
    formulaire.append('photo', await lireFichier(uri), 'photo.jpg');
  } catch (e) {
    console.warn('[ml] lecture de la photo impossible', e);
    throw new ErreurML('Impossible de lire la photo sur le téléphone.');
  }

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      body: formulaire,
      headers: enTetes(),
    });
  } catch (e) {
    console.warn('[ml] envoi de la photo échoué', e);
    throw new ErreurML('Serveur d’analyse injoignable. Vérifie ta connexion.');
  }
  if (reponse.status === 401 || reponse.status === 503) {
    throw new ErreurML('L’analyse de la photo n’est pas disponible pour l’instant.', reponse.status);
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
    return (await fetch(adresse(), { headers: enTetes() })).ok;
  } catch {
    return false;
  }
}
