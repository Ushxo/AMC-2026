import { fireEvent, render, screen } from '@testing-library/react-native';

import { MESSAGE_RECU_SANS_CONFIRMATION } from '../../src/lib/messages-seuil';
import Signaler from '../../src/app/(citoyen)/signaler';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ lat: '45.5', lng: '-73.57' }),
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

const mockEnvoyer = jest.fn();
jest.mock('@/hooks/use-creer-signalement', () => ({
  useCreerSignalement: () => ({ envoyer: (...a: unknown[]) => mockEnvoyer(...a), envoiEnCours: false }),
}));

const acceptee = { valide: true, probabilite_valide: 97, score_gravite: 80, gravite: 'elevee', probabilites: { invalide: 3, faible: 5, moyenne: 12, elevee: 80 } };

async function jusquAuFormulaire(avecPhoto: boolean) {
  await render(<Signaler />);
  await fireEvent.press(screen.getByLabelText('Égout bouché'));
  await fireEvent.press(screen.getByText('Continuer'));
  if (avecPhoto) {
    await fireEvent.press(screen.getByText('Prendre la photo'));
    await fireEvent.press(screen.getByText('Continuer la photo'));
    await screen.findByText('Photo acceptée');
  } else {
    await fireEvent.press(screen.getByText('Étape photo'));
  }
}

describe('signalement : seuil selon la photo', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';
    mockEnvoyer.mockReset();
    mockJuger.mockResolvedValue(acceptee);
  });

  it('photo acceptée : photoVerifiee est vrai à l’envoi', async () => {
    mockEnvoyer.mockResolvedValue({ statut: 'envoye', signalement: { id: 's1' } });
    await jusquAuFormulaire(true);
    await fireEvent.press(screen.getByText('Envoyer le signalement'));
    expect(await screen.findByText('Merci, votre signalement est envoyé.')).toBeTruthy();
    expect(mockEnvoyer).toHaveBeenCalledWith(expect.objectContaining({ photoVerifiee: true, photoUri: 'file:///p.jpg' }));
  });

  it('sans photo : photoVerifiee est faux et le message explique quand le signalement apparaîtra', async () => {
    mockEnvoyer.mockResolvedValue({ statut: 'envoye', signalement: { id: 's2' } });
    await jusquAuFormulaire(false);
    await fireEvent.press(screen.getByText('Envoyer le signalement'));
    expect(await screen.findByText(MESSAGE_RECU_SANS_CONFIRMATION)).toBeTruthy();
    expect(mockEnvoyer).toHaveBeenCalledWith(expect.objectContaining({ photoVerifiee: false }));
  });
});
