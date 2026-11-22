import { Directory, File, Paths } from 'expo-file-system';

const NOM_DOSSIER = 'photos-en-attente';

/** Copie la photo dans le dossier durable de l'app. Rend l'adresse de la copie, ou null si la copie échoue. */
export async function copierPhotoDurable(uri: string, id: string): Promise<string | null> {
  try {
    const dossier = new Directory(Paths.document, NOM_DOSSIER);
    if (!dossier.exists) dossier.create({ intermediates: true, idempotent: true });
    const destination = new File(dossier, `${id}.jpg`);
    if (destination.exists) destination.delete();
    await new File(uri).copy(destination);
    return destination.uri;
  } catch {
    return null;
  }
}

export function supprimerPhotoDurable(uri: string): void {
  try {
    if (uri.includes(`/${NOM_DOSSIER}/`)) {
      const f = new File(uri);
      if (f.exists) f.delete();
    }
  } catch {
    // Fichier déjà absent : rien à faire.
  }
}
