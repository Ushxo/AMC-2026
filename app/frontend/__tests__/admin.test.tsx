import { fireEvent, render, screen } from '@testing-library/react-native';

import AdminApp from '../admin/AdminApp';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => ({ nom: 'Admin Test' }) }));
jest.mock('@/app/ville/equipes', () => {
  const { Text } = jest.requireActual('react-native');
  return { EcranEquipes: () => <Text>Écran des équipes</Text> };
});
jest.mock('../supervisor/SupervisorApp', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onAdministration }: { onAdministration?: () => void }) => (
      <Pressable onPress={onAdministration}>
        <Text>Espace superviseur</Text>
      </Pressable>
    ),
  };
});
jest.mock('../admin/CreerComptePersonnel', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ onBack }: { onBack: () => void }) => (<Pressable onPress={onBack}><Text>Créer un compte du personnel (écran)</Text></Pressable>) };
});
const mockLister = jest.fn();
jest.mock('@/lib/comptes-admin', () => ({
  ...jest.requireActual('@/lib/comptes-admin'),
  listerComptes: () => mockLister(),
}));
jest.mock('@/lib/organisations', () => ({
  ...jest.requireActual('@/lib/organisations'),
  lireOrganisations: async () => ({ organisations: jest.requireActual('@/lib/organisations').ORGANISATIONS_EMBARQUEES, enBase: false }),
}));

describe('espace d’administration', () => {
  it('liste les comptes avec rôle, ouvre la création, la marque, les équipes et l’espace superviseur', async () => {
    mockLister.mockResolvedValue({ complete: true, comptes: [{ id: 'u1', courriel: 'lea@ville.ca', role: 'employe', poste: 'commis', nom: 'Léa Roy', organisation: 'Priorix', equipe: 'Équipe 1', creeLe: null }] });
    await render(<AdminApp onLogout={jest.fn()} />);
    expect(await screen.findByText('Léa Roy')).toBeTruthy();
    expect(screen.getByText(/Employé d'équipe · Priorix · Équipe 1/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Créer un compte du personnel'));
    expect(screen.getByText('Créer un compte du personnel (écran)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Créer un compte du personnel (écran)'));
    await fireEvent.press(screen.getByText('Équipes'));
    expect(screen.getByText('Écran des équipes')).toBeTruthy();
    await fireEvent.press(screen.getByText('Marque'));
    expect(await screen.findByText('Aperçu en direct')).toBeTruthy();
    expect(screen.getByText('Ville de Montréal')).toBeTruthy();
    await fireEvent.press(screen.getByText('Superviseur'));
    expect(screen.getByText('Espace superviseur')).toBeTruthy();
    await fireEvent.press(screen.getByText('Espace superviseur')); // retour à l'administration
    expect(screen.getByText('Administration')).toBeTruthy();
  });

  it('état vide et erreur de lecture', async () => {
    mockLister.mockResolvedValue({ complete: true, comptes: [] });
    const { unmount } = await render(<AdminApp onLogout={jest.fn()} />);
    expect(await screen.findByText('Aucun compte du personnel pour le moment.')).toBeTruthy();
    unmount();
    mockLister.mockResolvedValue(null);
    await render(<AdminApp onLogout={jest.fn()} />);
    expect(await screen.findByText(/ne peuvent pas être lus/)).toBeTruthy();
  });
});
