jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('client Supabase hors appareil (export, rendu serveur)', () => {
  const ancien = { ...process.env };
  const fenetre = (globalThis as { window?: unknown }).window;
  afterEach(() => {
    (globalThis as { window?: unknown }).window = fenetre;
    process.env = { ...ancien };
    jest.resetModules();
  });

  it('se crée sans stockage ni session gardée, sans planter', () => {
    delete (globalThis as { window?: unknown }).window;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-factice-pour-test';
    expect(typeof window).toBe('undefined');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabase } = require('../supabase') as typeof import('../supabase');
      expect(() => getSupabase()).not.toThrow();
      expect(getSupabase()).not.toBeNull();
    });
  });
});
