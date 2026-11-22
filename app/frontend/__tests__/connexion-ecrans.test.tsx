import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginScreen from '../citizen/LoginScreen';
import SignupScreen from '../auth/SignupScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const actions = () => ({ onSignup: jest.fn(), onForgot: jest.fn() });

describe('écran de connexion', () => {
  it('courriel invalide ou mot de passe vide : dit quoi corriger, sans appeler la connexion', async () => {
    const onLogin = jest.fn(async () => null);
    await render(<LoginScreen onLogin={onLogin} {...actions()} />);
    await fireEvent.press(screen.getByText('Se connecter'));
    expect(screen.getByText(/Entrez un courriel valide/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Courriel'), 'nom@ville.ca');
    await fireEvent.press(screen.getByText('Se connecter'));
    expect(screen.getByText('Entrez votre mot de passe.')).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('une connexion refusée affiche le message du service', async () => {
    const onLogin = jest.fn(async () => 'Courriel ou mot de passe refusé.');
    await render(<LoginScreen onLogin={onLogin} {...actions()} />);
    await fireEvent.changeText(screen.getByLabelText('Courriel'), 'nom@ville.ca');
    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'secret');
    await fireEvent.press(screen.getByText('Se connecter'));
    await waitFor(() => expect(screen.getByText('Courriel ou mot de passe refusé.')).toBeTruthy());
    expect(onLogin).toHaveBeenCalledWith('nom@ville.ca', 'secret');
  });

  it('« Créer un compte » et « Mot de passe oublié » mènent à leurs écrans ; la démonstration hors ligne n’apparaît que si elle est offerte', async () => {
    const a = actions();
    const { rerender } = await render(<LoginScreen onLogin={async () => null} {...a} />);
    expect(screen.queryByText(/Démonstration hors ligne/)).toBeNull();
    await fireEvent.press(screen.getByText('Créer un compte'));
    await fireEvent.press(screen.getByText('Mot de passe oublié ?'));
    expect(a.onSignup).toHaveBeenCalled();
    expect(a.onForgot).toHaveBeenCalled();
    const onDemo = jest.fn();
    await rerender(<LoginScreen onLogin={async () => null} {...a} onDemo={onDemo} />);
    await fireEvent.press(screen.getByText('Démonstration hors ligne (simulée)'));
    expect(onDemo).toHaveBeenCalled();
  });
});

describe('création de compte', () => {
  it('après un essai, chaque champ invalide dit quoi corriger ; un compte valide part', async () => {
    const onSignup = jest.fn(async () => null);
    await render(<SignupScreen onSignup={onSignup} onBack={() => {}} />);
    await fireEvent.press(screen.getByText('Créer mon compte'));
    expect(screen.getByText('Entrez votre courriel.')).toBeTruthy();
    expect(screen.getByText('Entrez votre mot de passe.')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Courriel'), 'nom@ville.ca');
    await fireEvent.changeText(screen.getByPlaceholderText(/Mot de passe/), 'court');
    expect(screen.getByText(/8 caractères au moins/)).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText(/Mot de passe/), 'assezlongpourvaloir');
    await fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(onSignup).toHaveBeenCalledWith({ courriel: 'nom@ville.ca', motDePasse: 'assezlongpourvaloir', prenom: '', nom: '' }));
  });

  it('une erreur du service (courriel déjà utilisé) s’affiche', async () => {
    const onSignup = jest.fn(async () => 'Un compte existe déjà avec cet email.');
    await render(<SignupScreen onSignup={onSignup} onBack={() => {}} />);
    await fireEvent.changeText(screen.getByPlaceholderText('Courriel'), 'nom@ville.ca');
    await fireEvent.changeText(screen.getByPlaceholderText(/Mot de passe/), 'assezlongpourvaloir');
    await fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(screen.getByText('Un compte existe déjà avec cet email.')).toBeTruthy());
  });
});
