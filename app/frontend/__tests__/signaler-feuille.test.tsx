import { fireEvent, render, screen } from '@testing-library/react-native';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, textesIllisibles } from '../aide-tests/lisibilite';
import { reinitialiserMarque } from '../../src/marque/magasin';

import Signaler from '../../src/app/(citoyen)/signaler';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ lat: '45.5', lng: '-73.57' }),
  useNavigation: () => ({ addListener: () => () => {} }),
}));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: jest.requireActual('react-native').View };
});
jest.mock('@/components/carte', () => ({ Carte: () => null, Repere: () => null }));
const mockJuger = jest.fn();
jest.mock('@/lib/ml', () => ({ jugerPhoto: (...a: unknown[]) => mockJuger(...a) }));
jest.mock('../citizen/PhotoStep', () => {
  const { Text, Pressable, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onSkip, onPhoto, onContinue }: { onSkip: () => void; onPhoto: (u: string) => void; onContinue: () => void }) => (
      <View>
        <Pressable onPress={onSkip}>
          <Text>Étape photo</Text>
        </Pressable>
        <Pressable onPress={() => onPhoto('file:///p.jpg')}>
          <Text>Prendre la photo</Text>
        </Pressable>
        <Pressable onPress={onContinue}>
          <Text>Continuer la photo</Text>
        </Pressable>
      </View>
    ),
  };
});

describe('signalement : feuille des quatre problèmes', () => {
  it('propose seulement les quatre problèmes, puis la photo, puis le formulaire', async () => {
    await render(<Signaler />);
    expect(screen.getByText('Quel problème avez-vous observé ?')).toBeTruthy();
    expect(screen.getByLabelText('Égout bouché')).toBeTruthy();
    expect(screen.getByLabelText("Accumulation d'eau ou inondation")).toBeTruthy();
    expect(screen.getByLabelText("Affaissement autour d'un égout")).toBeTruthy();
    expect(screen.getByLabelText("Grille d'égout endommagée")).toBeTruthy();
    expect(screen.queryByLabelText('Autre')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Égout bouché'));
    await fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Étape photo')).toBeTruthy();
    await fireEvent.press(screen.getByText('Étape photo'));
    expect(screen.getByText('Derniers détails')).toBeTruthy();
    expect(screen.getByText('Étape 3 sur 3')).toBeTruthy();
    expect(screen.getByText('Égout bouché')).toBeTruthy();
    expect(screen.queryByText('Importance')).toBeNull();
    expect(screen.getByText('Envoyer le signalement')).toBeTruthy();
  });

  it('ne continue pas sans choisir un problème', async () => {
    await render(<Signaler />);
    await fireEvent.press(screen.getByText('Continuer'));
    expect(screen.queryByText('Étape photo')).toBeNull();
  });

  it('photo acceptée : le résumé le dit, sans jamais parler de gravité ; sans photo : rien de bloquant', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';
    mockJuger.mockResolvedValue({ valide: true, probabilite_valide: 97, score_gravite: 80, gravite: 'elevee', probabilites: { invalide: 3, faible: 5, moyenne: 12, elevee: 80 } });
    await render(<Signaler />);
    await fireEvent.press(screen.getByLabelText('Égout bouché'));
    await fireEvent.press(screen.getByText('Continuer'));
    await fireEvent.press(screen.getByText('Prendre la photo'));
    await fireEvent.press(screen.getByText('Continuer la photo'));
    expect(await screen.findByText('Photo acceptée')).toBeTruthy();
    expect(screen.queryByText(/gravité|importance|Importance/)).toBeNull();
    expect(screen.getByText('Envoyer le signalement')).toBeTruthy();
  });

  it('photo refusée : retirée, expliquée, et on peut en reprendre une', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';
    mockJuger.mockResolvedValue({ valide: false, probabilite_valide: 5, score_gravite: null, gravite: null, probabilites: { invalide: 95, faible: 2, moyenne: 2, elevee: 1 } });
    await render(<Signaler />);
    await fireEvent.press(screen.getByLabelText('Égout bouché'));
    await fireEvent.press(screen.getByText('Continuer'));
    await fireEvent.press(screen.getByText('Prendre la photo'));
    await fireEvent.press(screen.getByText('Continuer la photo'));
    expect(await screen.findByText(/Photo refusée : reprenez-en une/)).toBeTruthy();
    expect(screen.getByText(/ne montre pas un égout/)).toBeTruthy();
    expect(screen.getByText('Ajouter une photo (facultatif)')).toBeTruthy(); // retirée, on peut en reprendre une
  });
});

describe('lisibilité sous chaque thème (signaler-feuille)', () => {
  beforeEach(() => reinitialiserMarque());
  it.each(COMBINAISONS_THEMES)('thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<Signaler />);
    expect(textesIllisibles()).toEqual([]);
  });
});
