import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE = 'signalement-mtl:mes-signalements';
const MAX = 200;

/** Identifiants des signalements créés depuis ce téléphone (« Mes alertes »). Le plus récent en premier. */
export async function lireMesIds(): Promise<string[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return []; // stockage illisible : « Mes alertes » est vide, rien ne casse
  }
}

export async function ajouterMonId(id: string): Promise<void> {
  try {
    const avant = await lireMesIds();
    await AsyncStorage.setItem(CLE, JSON.stringify([id, ...avant.filter((x) => x !== id)].slice(0, MAX)));
    ecouteurs.forEach((f) => f());
  } catch {
    // Stockage plein ou refusé : le signalement est envoyé quand même, il manquera seulement dans « Mes alertes ».
  }
}

const ecouteurs = new Set<() => void>();
export function abonnerMesIds(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}
