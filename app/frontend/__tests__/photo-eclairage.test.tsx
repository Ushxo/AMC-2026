import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, fondDeLaRacine, textesIllisibles } from '../aide-tests/lisibilite';
import { lireMarque } from '../../src/marque/magasin';
import { reinitialiserMarque } from '../../src/marque/magasin';

import PhotoStep from '../citizen/PhotoStep';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockGalerie = jest.fn();
jest.mock('expo-image-picker', () => ({ launchCameraAsync: jest.fn(), launchImageLibraryAsync: (...a: unknown[]) => mockGalerie(...a) }));
const mockProps: Record<string, unknown>[] = [];
const mockPermission: { etat: { granted: boolean; canAskAgain?: boolean } } = { etat: { granted: true } };
jest.mock('@/lib/camera-optionnelle', () => {
  const React = jest.requireActual('react');
  return {
    CameraView: React.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockProps.push(props);
      return null;
    }),
    useCameraPermissions: () => [mockPermission.etat, jest.fn()],
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
    await unmount();
    const b = await rendre({ statut: 'acceptee', message: 'Photo acceptée' });
    expect(screen.getByText(/apparaît tout de suite sur la carte/)).toBeTruthy();
    await b.unmount();
    const c = await rendre({ statut: 'impossible', message: 'La photo n’a pas pu être vérifiée' });
    expect(screen.queryByText(/apparaît tout de suite sur la carte/)).toBeNull();
    await c.unmount();
    await rendre({ statut: 'refusee', message: 'Pas un égout' });
    expect(screen.queryByText(/apparaît tout de suite sur la carte/)).toBeNull();
  });
});

describe('caméra ou galerie refusée', () => {
  it('la galerie qui refuse de s’ouvrir donne une phrase, sans rejet ni bouton mort', async () => {
    mockGalerie.mockRejectedValue(new Error('panne du sélecteur'));
    const onPhoto = jest.fn();
    await render(<PhotoStep onPhoto={onPhoto} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Choisir dans la galerie'));
    expect(await screen.findByText(/La galerie n'a pas pu s'ouvrir/)).toBeTruthy();
    expect(onPhoto).not.toHaveBeenCalled();
    mockGalerie.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///g.jpg' }] });
    await fireEvent.press(screen.getByLabelText('Choisir dans la galerie'));
    await waitFor(() => expect(onPhoto).toHaveBeenCalledWith('file:///g.jpg'));
    expect(screen.queryByText(/La galerie n'a pas pu/)).toBeNull();
  });

  it('autorisation refusée : phrase claire, bouton vers les réglages, et « Passer » reste possible', async () => {
    const ouvrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    mockGalerie.mockRejectedValue(new Error('Missing photo library permission: denied'));
    const onSkip = jest.fn();
    await render(<PhotoStep onPhoto={jest.fn()} onBack={jest.fn()} onSkip={onSkip} onContinue={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Choisir dans la galerie'));
    expect(await screen.findByText(/L'accès aux photos est refusé. Autorisez-le dans Réglages, ou continuez sans photo./)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ouvrir les réglages'));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Passer la photo'));
    expect(onSkip).toHaveBeenCalled();
    ouvrir.mockRestore();
  });

  it('caméra refusée pour de bon : le bouton ouvre les réglages au lieu de ne rien faire', async () => {
    const ouvrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    mockPermission.etat = { granted: false, canAskAgain: false };
    await render(<PhotoStep onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);
    expect(screen.getByText(/L’accès à l’appareil photo est refusé/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ouvrir les réglages'));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    mockPermission.etat = { granted: true };
    ouvrir.mockRestore();
  });
});

describe('lisibilité sous chaque thème (photo-eclairage)', () => {
  beforeEach(() => reinitialiserMarque());
  it.each(COMBINAISONS_THEMES)('thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<PhotoStep onPhoto={jest.fn()} onBack={jest.fn()} onSkip={jest.fn()} onContinue={jest.fn()} />);
    expect(textesIllisibles()).toEqual([]);
    expect(fondDeLaRacine()).toBe(lireMarque().jetons.background); // l'écran pose lui-même le fond du thème
  });
});
