import { analyserErreurEnvoi } from '../erreurs-envoi';
import { urlPhotoDuBucket, urlPhotoSure } from '../photo';

describe('analyserErreurEnvoi', () => {
  it('photo trop lourde : permanent avec le motif', () => {
    expect(analyserErreurEnvoi({ statusCode: '413', message: 'x' })).toEqual({
      permanent: true,
      motif: 'La photo est trop lourde (5 Mo au plus). Reprenez-la plus petite.',
    });
    expect(analyserErreurEnvoi({ message: 'The object exceeded the maximum allowed size' }).permanent).toBe(true);
  });
  it('ligne refusée par la base : permanent', () => {
    expect(analyserErreurEnvoi({ code: '42501', message: 'rls' }).permanent).toBe(true);
    expect(analyserErreurEnvoi({ code: '23514', message: 'check' }).permanent).toBe(true);
    expect(analyserErreurEnvoi({ status: 400 }).permanent).toBe(true);
  });
  it('réseau, délai, serveur : passager', () => {
    expect(analyserErreurEnvoi(new Error('delai')).permanent).toBe(false);
    expect(analyserErreurEnvoi(new TypeError('Network request failed')).permanent).toBe(false);
    expect(analyserErreurEnvoi({ status: 503 }).permanent).toBe(false);
    expect(analyserErreurEnvoi({ status: 429 }).permanent).toBe(false);
    expect(analyserErreurEnvoi(null).permanent).toBe(false);
  });
});

describe('urlPhotoSure', () => {
  const ancienne = process.env.EXPO_PUBLIC_SUPABASE_URL;
  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co/';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = ancienne;
  });

  it('accepte une photo de notre bucket', () => {
    const u = urlPhotoDuBucket('id-1.jpg');
    expect(u).toBe('https://abc.supabase.co/storage/v1/object/public/photos-signalements/id-1.jpg');
    expect(urlPhotoSure(u)).toBe(u);
  });
  it('refuse les adresses externes ou détournées', () => {
    expect(urlPhotoSure('https://exemple.com/x.jpg')).toBeNull();
    expect(urlPhotoSure('https://abc.supabase.co.evil.com/storage/v1/object/public/photos-signalements/x.jpg')).toBeNull();
    expect(urlPhotoSure('https://abc.supabase.co/storage/v1/object/public/autre/x.jpg')).toBeNull();
    expect(urlPhotoSure('https://abc.supabase.co/storage/v1/object/public/photos-signalements/../x.jpg')).toBeNull();
    expect(urlPhotoSure('https://abc.supabase.co/storage/v1/object/public/photos-signalements/')).toBeNull();
    expect(urlPhotoSure(null)).toBeNull();
  });
});
