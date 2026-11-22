import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { lireBrouillon, viderBrouillon, ecrireBrouillon } from '../../src/lib/brouillon-signalement';
import Signaler from '../../src/app/(citoyen)/signaler';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockEnvoyer = jest.fn();
jest.mock('@/hooks/use-creer-signalement', () => ({
  useCreerSignalement: () => ({ envoyer: (...a: unknown[]) => mockEnvoyer(...a), envoiEnCours: false }),
}));
const mockBack = jest.fn();
const mockBeforeRemove: { f: (() => void) | null } = { f: null };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ lat: '45.5', lng: '-73.57', categorie: 'grille_bouchee' }),
  useNavigation: () => ({ addListener: (_n: string, f: () => void) => { mockBeforeRemove.f = f; return () => {}; } }),
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
    default: ({ onSkip, onPhoto, onContinue, onBack, photoUri }: { onSkip: () => void; onPhoto: (u: string) => void; onContinue: () => void; onBack: () => void; photoUri?: string }) => (
      <View>
        <Pressable onPress={onBack}>
          <Text>Retour photo</Text>
        </Pressable>
        {photoUri ? <Text>{`Photo reprise ${photoUri}`}</Text> : null}
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

const acceptee = { valide: true, probabilite_valide: 97, score_gravite: 80, gravite: 'elevee', probabilites: { invalide: 3, faible: 5, moyenne: 12, elevee: 80 } };

describe('signalement : retour vers la carte et brouillon', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';
    mockBack.mockReset();
    mockBeforeRemove.f = null;
    viderBrouillon();
    mockJuger.mockResolvedValue(acceptee);
  });

  it('la flèche de la photo revient à la carte, feuille rouverte, problème, lieu et photo gardés', async () => {
    await render(<Signaler />);
    await fireEvent.press(screen.getByText('Prendre la photo'));
    await screen.findByText('Photo reprise file:///p.jpg');
    await fireEvent.press(screen.getByText('Retour photo'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(lireBrouillon()).toMatchObject({
      feuilleOuverte: true,
      categorie: 'grille_bouchee',
      lieu: { latitude: 45.5, longitude: -73.57 },
      photoUri: 'file:///p.jpg',
    });
  });

  it('le geste de retour (avant la suppression de l’écran) rouvre aussi la feuille', async () => {
    await render(<Signaler />);
    expect(lireBrouillon().feuilleOuverte).toBe(false);
    await act(async () => mockBeforeRemove.f?.());
    expect(lireBrouillon().feuilleOuverte).toBe(true);
  });

  it('en repartant en avant, la photo et le commentaire du brouillon sont repris', async () => {
    ecrireBrouillon({ categorie: 'grille_bouchee', photoUri: 'file:///avant.jpg', commentaire: 'depuis hier' });
    await render(<Signaler />);
    expect(await screen.findByText('Photo reprise file:///avant.jpg')).toBeTruthy();
    await fireEvent.press(screen.getByText('Continuer la photo'));
    expect(screen.getByDisplayValue('depuis hier')).toBeTruthy();
  });

  it('un signalement envoyé vide le brouillon et ne rouvre rien', async () => {
    await render(<Signaler />);
    await fireEvent.press(screen.getByText('Étape photo'));
    mockEnvoyer.mockResolvedValue({ statut: 'envoye', signalement: { id: 's1' } });
    await fireEvent.press(screen.getByText('Envoyer le signalement'));
    await screen.findByText(/Signalement reçu|Merci/);
    expect(lireBrouillon().categorie).toBeNull();
    await act(async () => mockBeforeRemove.f?.());
    expect(lireBrouillon().feuilleOuverte).toBe(false);
  });
});
