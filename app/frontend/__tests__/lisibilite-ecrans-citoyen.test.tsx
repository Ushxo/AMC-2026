import { render, screen } from '@testing-library/react-native';

import MyAlerts from '../citizen/MyAlerts';
import Suivi from '../../src/app/(citoyen)/suivi/[id]';
import Endroit from '../../src/app/ville/endroit';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, textesIllisibles } from '../aide-tests/lisibilite';
import { reinitialiserMarque } from '../../src/marque/magasin';
import { regrouper } from '../../src/lib/gravite';
import type { Signalement } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 's1', cle: 'cle-1' }),
}));
jest.mock('@/components/carte', () => ({ Carte: () => null, Repere: () => null }));

const sig = (id: string, etat: Signalement['etat'], categorie: Signalement['categorie'], verifiee = true): Signalement => ({
  id,
  origine: 'citoyen',
  cree_le: '2026-11-20T10:00:00Z',
  latitude: 45.5,
  longitude: -73.57,
  categorie,
  gravite: 'elevee',
  commentaire: 'Eau sur la chaussée',
  photo_url: null,
  photo_verifiee: verifiee,
  grille_id: null,
  etat,
  etat_change_le: '2026-11-20T11:00:00Z',
  exemple_demo: false,
});
const TOUS = [sig('s1', 'nouveau', 'grille_bouchee', false), sig('s2', 'pris_en_charge', 'eau_accumulee'), sig('s3', 'regle', 'grille_endommagee' as never), sig('s4', 'rejete', 'autre')];

jest.mock('@/hooks/use-signalements', () => ({ useSignalements: () => ({ signalements: TOUS_REF.v, chargement: false, erreur: null, rafraichir: jest.fn() }) }));
const TOUS_REF: { v: Signalement[] } = { v: [] };
jest.mock('@/hooks/use-mes-signalements', () => ({ useMesSignalements: () => ({ mes: TOUS_REF.v, chargement: false, erreur: null, rafraichir: jest.fn(), nonGardes: true }) }));
jest.mock('@/hooks/use-passage', () => ({
  usePassage: () => ({ suivi: { etape: 'planifie', heure_estimee: '2026-11-22T13:15:00Z', rang: 2, depuis: '2026-11-22T11:00:00Z', precalcule: true }, chargement: false, erreur: null }),
}));

beforeEach(() => {
  reinitialiserMarque();
  TOUS_REF.v = TOUS;
});

describe('lisibilité sous chaque thème : Mes alertes, suivi, fiche d’un endroit', () => {
  it.each(COMBINAISONS_THEMES)('Mes alertes, thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<MyAlerts />);
    expect(screen.getAllByText(/Mes alertes/).length).toBeGreaterThan(0);
    expect(textesIllisibles()).toEqual([]);
  });

  it.each(COMBINAISONS_THEMES)('suivi d’une alerte, thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<Suivi />);
    expect(textesIllisibles()).toEqual([]);
  });

  it.each(COMBINAISONS_THEMES)('fiche d’un endroit, thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    const [endroit] = regrouper([sig('s1', 'nouveau', 'grille_bouchee'), sig('s2', 'nouveau', 'grille_bouchee')]);
    TOUS_REF.v = endroit.signalements;
    jest.requireMock('expo-router').useLocalSearchParams = () => ({ cle: endroit.cle });
    await render(<Endroit />);
    expect(textesIllisibles()).toEqual([]);
  });
});
