import { fireEvent, render, screen } from '@testing-library/react-native';

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
jest.mock('../citizen/PhotoStep', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onSkip }: { onSkip: () => void }) => (
      <Pressable onPress={onSkip}>
        <Text>Étape photo</Text>
      </Pressable>
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
    expect(screen.getByText('2. Problème choisi')).toBeTruthy();
  });

  it('ne continue pas sans choisir un problème', async () => {
    await render(<Signaler />);
    await fireEvent.press(screen.getByText('Continuer'));
    expect(screen.queryByText('Étape photo')).toBeNull();
  });
});
