import { BUCKET_PHOTOS } from './config';

function baseSupabase(): string | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

/** Adresse publique d'une photo de notre bucket. */
export function urlPhotoDuBucket(chemin: string): string | null {
  const base = baseSupabase();
  return base ? `${base}/storage/v1/object/public/${BUCKET_PHOTOS}/${chemin}` : null;
}

/** Rend l'adresse seulement si elle pointe vers le bucket de notre projet Supabase. */
export function urlPhotoSure(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefixe = urlPhotoDuBucket('');
  if (!prefixe || !url.startsWith(prefixe) || url.length === prefixe.length) return null;
  const reste = url.slice(prefixe.length);
  return /[\\?#]|\.\.|\/\//.test(reste) ? null : url;
}
