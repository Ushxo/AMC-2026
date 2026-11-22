import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE = 'signalement-mtl:mes-signalements';
const MAX = 200;

// Les identifiants de cette session restent aussi en mémoire : si le stockage du téléphone refuse l'écriture, le signalement
// ne disparaît pas de « Mes alertes » tant que l'app reste ouverte.
let enMemoire: string[] = [];
let nonGardes = false;

/** Vrai quand le stockage a refusé d'écrire : les signalements de la session ne seront plus listés après la fermeture de l'app. */
export function mesIdsNonGardes(): boolean {
  return nonGardes;
}

export function reinitialiserMesIds(): void {
  enMemoire = [];
  nonGardes = false;
}

async function lireGardes(): Promise<string[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return []; // stockage illisible : on ne montre que ce qui est en mémoire, rien ne casse
  }
}

/** Identifiants des signalements créés depuis ce téléphone (« Mes alertes »). Le plus récent en premier. */
export async function lireMesIds(): Promise<string[]> {
  const gardes = await lireGardes();
  return [...enMemoire, ...gardes.filter((x) => !enMemoire.includes(x))].slice(0, MAX);
}

export async function ajouterMonId(id: string): Promise<void> {
  enMemoire = [id, ...enMemoire.filter((x) => x !== id)].slice(0, MAX);
  try {
    const avant = await lireGardes();
    await AsyncStorage.setItem(CLE, JSON.stringify([id, ...avant.filter((x) => x !== id)].slice(0, MAX)));
    nonGardes = false;
  } catch {
    nonGardes = true; // stockage plein ou refusé : visible pendant la session seulement
  }
  ecouteurs.forEach((f) => f());
}

const ecouteurs = new Set<() => void>();
export function abonnerMesIds(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}
