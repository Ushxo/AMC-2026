import { choisirIdCarte, lireFondCarte, lireReglagesTuiles } from '../carte-reglages';

describe('tuiles de carte personnalisées', () => {
  it('sont coupées par défaut', () => {
    expect(lireReglagesTuiles({}).actif).toBe(false);
  });

  it('ne s’activent que avec le réglage, un modèle d’adresse et une attribution', () => {
    const modele = 'https://exemple.test/{z}/{x}/{y}.png';
    expect(lireReglagesTuiles({ EXPO_PUBLIC_TUILES_ACTIVES: '1' }).actif).toBe(false);
    expect(lireReglagesTuiles({ EXPO_PUBLIC_TUILES_ACTIVES: '1', EXPO_PUBLIC_TUILES_URL: modele }).actif).toBe(false);
    expect(
      lireReglagesTuiles({ EXPO_PUBLIC_TUILES_URL: modele, EXPO_PUBLIC_TUILES_ATTRIBUTION: 'Fond : X' }).actif,
    ).toBe(false);
    expect(
      lireReglagesTuiles({
        EXPO_PUBLIC_TUILES_ACTIVES: '1',
        EXPO_PUBLIC_TUILES_URL: modele,
        EXPO_PUBLIC_TUILES_ATTRIBUTION: 'Fond : X',
      }).actif,
    ).toBe(true);
  });
});

describe('fond de carte Google', () => {
  const nativ = { dansExpoGo: false, googleInstalle: true };

  it('reste sur Apple Plans sans réglage', () => {
    expect(lireFondCarte({}, nativ)).toEqual({ google: false, idCarte: undefined });
  });

  it('active Google avec le réglage dans une build native qui embarque Google, avec l’identifiant de carte', () => {
    const env = { EXPO_PUBLIC_CARTE_FOURNISSEUR: 'google', EXPO_PUBLIC_GOOGLE_MAP_ID: ' abc123 ' };
    expect(lireFondCarte(env, nativ)).toEqual({ google: true, idCarte: 'abc123' });
    expect(lireFondCarte({ EXPO_PUBLIC_CARTE_FOURNISSEUR: 'Google' }, nativ)).toEqual({ google: true, idCarte: undefined });
  });

  it('jamais dans Expo Go, ni si le module natif Google manque', () => {
    const env = { EXPO_PUBLIC_CARTE_FOURNISSEUR: 'google', EXPO_PUBLIC_GOOGLE_MAP_ID: 'abc123' };
    expect(lireFondCarte(env, { dansExpoGo: true, googleInstalle: true }).google).toBe(false);
    expect(lireFondCarte(env, { dansExpoGo: false, googleInstalle: false })).toEqual({ google: false, idCarte: undefined });
  });
});

describe('identifiant de carte Google selon le thème', () => {
  const deux = { EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR: 'clair1', EXPO_PUBLIC_GOOGLE_MAP_ID_SOMBRE: 'sombre1', EXPO_PUBLIC_GOOGLE_MAP_ID: 'ancien' };

  it('suit le thème', () => {
    expect(choisirIdCarte(deux, 'light')).toBe('clair1');
    expect(choisirIdCarte(deux, 'dark')).toBe('sombre1');
  });

  it('se rabat sur l’autre style, puis sur l’ancien identifiant, puis sur aucun', () => {
    expect(choisirIdCarte({ EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR: 'clair1' }, 'dark')).toBe('clair1');
    expect(choisirIdCarte({ EXPO_PUBLIC_GOOGLE_MAP_ID_SOMBRE: 'sombre1' }, 'light')).toBe('sombre1');
    expect(choisirIdCarte({ EXPO_PUBLIC_GOOGLE_MAP_ID_CLAIR: '  ', EXPO_PUBLIC_GOOGLE_MAP_ID: 'ancien' }, 'light')).toBe('ancien');
    expect(choisirIdCarte({}, 'dark')).toBeUndefined();
  });

  it('lireFondCarte donne l’identifiant du thème, seulement si Google est actif', () => {
    const env = { EXPO_PUBLIC_CARTE_FOURNISSEUR: 'google', ...deux };
    const o = { dansExpoGo: false, googleInstalle: true };
    expect(lireFondCarte(env, { ...o, theme: 'dark' })).toEqual({ google: true, idCarte: 'sombre1' });
    expect(lireFondCarte(env, { ...o, theme: 'light' })).toEqual({ google: true, idCarte: 'clair1' });
    expect(lireFondCarte(env, { ...o, dansExpoGo: true, theme: 'dark' })).toEqual({ google: false, idCarte: undefined });
  });
});
