import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CreerComptePersonnel from '../admin/CreerComptePersonnel';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/use-equipes', () => ({ useEquipes: () => ({ equipes: [{ id: 'e1', nom: 'Équipe Nord', active: true }] }) }));
const mockCreer = jest.fn();
jest.mock('@/lib/compte-personnel', () => ({
  ...jest.requireActual('@/lib/compte-personnel'),
  creerComptePersonnel: (...a: unknown[]) => mockCreer(...a),
}));

async function remplir() {
  await fireEvent.changeText(screen.getByLabelText('Prénom'), 'Léa');
  await fireEvent.changeText(screen.getByLabelText('Nom'), 'Roy');
  await fireEvent.changeText(screen.getByLabelText('Courriel'), 'lea@ville.ca');
  await fireEvent.changeText(screen.getByLabelText('Mot de passe provisoire (8 caractères au moins)'), 'provisoire1');
}

describe('créer un compte du personnel', () => {
  beforeEach(() => mockCreer.mockReset());

  it('montre les erreurs par champ sans appeler le serveur', async () => {
    await render(<CreerComptePersonnel onBack={jest.fn()} />);
    await fireEvent.press(screen.getByText('Créer le compte'));
    expect(screen.getByText('Entrez le prénom.')).toBeTruthy();
    expect(screen.getByText('Choisissez un rôle.')).toBeTruthy();
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it('crée un employé d\'équipe avec l\'équipe choisie, confirme le rôle et vide le formulaire', async () => {
    mockCreer.mockResolvedValue({ ok: true, role: 'equipe', courriel: 'lea@ville.ca', avertissement: null });
    await render(<CreerComptePersonnel onBack={jest.fn()} />);
    await remplir();
    await fireEvent.press(screen.getByText("Employé d'équipe"));
    await fireEvent.press(screen.getByText('Équipe Nord'));
    await fireEvent.press(screen.getByText('Créer le compte'));
    await waitFor(() => expect(screen.getByText(/Compte créé : lea@ville.ca, rôle Employé d'équipe/)).toBeTruthy());
    expect(mockCreer).toHaveBeenCalledWith(expect.objectContaining({ role: 'equipe', equipeId: 'e1', courriel: 'lea@ville.ca' }));
    expect(screen.getByLabelText('Courriel').props.value).toBe('');
    expect(screen.getByLabelText('Mot de passe provisoire (8 caractères au moins)').props.value).toBe('');
  });

  it('affiche le refus du serveur et l\'erreur du champ courriel', async () => {
    mockCreer.mockResolvedValue({ ok: false, erreurs: { courriel: 'Un compte existe déjà avec ce courriel.' }, message: null });
    await render(<CreerComptePersonnel onBack={jest.fn()} />);
    await remplir();
    await fireEvent.press(screen.getByText('Superviseur'));
    await fireEvent.press(screen.getByText('Créer le compte'));
    await waitFor(() => expect(screen.getByText('Un compte existe déjà avec ce courriel.')).toBeTruthy());
  });
});
