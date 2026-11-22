import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import PhotoStep from '../citizen/PhotoStep';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image-picker', () => ({ launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
const mockProps: Record<string, unknown>[] = [];
jest.mock('@/lib/camera-optionnelle', () => {
  const React = jest.requireActual('react');
  return {
    CameraView: React.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockProps.push(props);
      return null;
    }),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

const derniere = () => mockProps[mockProps.length - 1];
const rendu = (photoUri?: string) =>
  render(<PhotoStep photoUri={photoUri} onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);

describe('éclairage de la caméra', () => {
  beforeEach(() => {
    mockProps.length = 0;
  });

  it('éteint au départ, la lampe s’allume et s’éteint au toucher (caméra arrière)', async () => {
    await rendu();
    expect(derniere()).toMatchObject({ enableTorch: false, flash: 'off', facing: 'back' });
    await fireEvent.press(screen.getByLabelText("Allumer l'éclairage"));
    expect(derniere()).toMatchObject({ enableTorch: true, flash: 'on' });
    await fireEvent.press(screen.getByLabelText("Éteindre l'éclairage"));
    expect(derniere()).toMatchObject({ enableTorch: false, flash: 'off' });
  });

  it('caméra avant : bouton désactivé et lampe éteinte', async () => {
    await rendu();
    await fireEvent.press(screen.getByLabelText("Allumer l'éclairage"));
    await fireEvent.press(screen.getByLabelText('Changer de caméra'));
    expect(derniere()).toMatchObject({ facing: 'front', enableTorch: false });
    const bouton = screen.getByLabelText("Pas d'éclairage avec la caméra avant");
    expect(bouton.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('la lampe s’éteint quand l’app passe en arrière-plan', async () => {
    let changement: (e: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_n: string, f: (e: string) => void) => {
      changement = f;
      return { remove: jest.fn() };
    }) as never);
    await rendu();
    await fireEvent.press(screen.getByLabelText("Allumer l'éclairage"));
    expect(derniere()).toMatchObject({ enableTorch: true });
    await act(async () => changement('background'));
    expect(derniere()).toMatchObject({ enableTorch: false });
    jest.restoreAllMocks();
  });

  it('la lampe s’éteint quand la photo est gardée', async () => {
    const { rerender } = await rendu();
    await fireEvent.press(screen.getByLabelText("Allumer l'éclairage"));
    await rerender(<PhotoStep photoUri="file:///p.jpg" onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);
    await rerender(<PhotoStep onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);
    expect(derniere()).toMatchObject({ enableTorch: false });
    expect(screen.getByLabelText("Allumer l'éclairage")).toBeTruthy();
  });
});

describe('ligne « avec une photo, tout de suite sur la carte »', () => {
  const rendre = (verification?: { statut: 'en_cours' | 'acceptee' | 'refusee' | 'impossible'; message: string }) =>
    render(<PhotoStep photoUri="file:///p.jpg" onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} verification={verification} />);

  it('montrée sans vérification ou photo acceptée ; cachée quand l’analyse est impossible ou la photo refusée (aucune contradiction)', async () => {
    const { unmount } = await rendre();
    expect(screen.getByText(/apparaît tout de suite sur la carte/)).toBeTruthy();
    unmount();
    const b = await rendre({ statut: 'acceptee', message: 'Photo acceptée' });
    expect(screen.getByText(/apparaît tout de suite sur la carte/)).toBeTruthy();
    b.unmount();
    const c = await rendre({ statut: 'impossible', message: 'La photo n’a pas pu être vérifiée' });
    expect(screen.queryByText(/apparaît tout de suite sur la carte/)).toBeNull();
    c.unmount();
    await rendre({ statut: 'refusee', message: 'Pas un égout' });
    expect(screen.queryByText(/apparaît tout de suite sur la carte/)).toBeNull();
  });
});
