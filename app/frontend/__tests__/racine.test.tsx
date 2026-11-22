import { fireEvent, render, screen } from '@testing-library/react-native';

import AppRoot from '../AppRoot';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo-google-fonts/montserrat', () => ({}));
const mockAcces = jest.fn();
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => mockAcces() }));
jest.mock('../auth/AuthFlow', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onRetour }: { onRetour?: () => void }) => (
      <Pressable onPress={onRetour}>
        <Text>Connexion du personnel</Text>
      </Pressable>
    ),
  };
});
jest.mock('../citizen/CitizenApp', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ compteConnecte, onStaffLogin }: { compteConnecte: boolean; onStaffLogin: () => void }) => (
      <Pressable onPress={onStaffLogin}>
        <Text>{compteConnecte ? 'Carte (compte citoyen)' : 'Carte (sans compte)'}</Text>
      </Pressable>
    ),
  };
});
jest.mock('../supervisor/SupervisorApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille superviseur</Text> };
});
jest.mock('../StaffApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille employé</Text> };
});

const base = { nom: null, equipeId: null, demoHorsLigne: false, deconnecter: async () => {}, citoyen: null };

describe('racine de l’app : le citoyen arrive sur la carte', () => {
  it('attend la reprise de la session, puis montre la carte SANS connexion', async () => {
    mockAcces.mockReturnValue({ ...base, ecran: null, pret: false });
    const { rerender } = await render(<AppRoot />);
    expect(screen.getByText('Ouverture de Priorix…')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: null, pret: true });
    await rerender(<AppRoot />);
    expect(screen.getByText('Carte (sans compte)')).toBeTruthy();
    expect(screen.queryByText('Connexion du personnel')).toBeNull();
  });

  it('l’icône de profil ouvre la connexion du personnel, avec retour à la carte', async () => {
    mockAcces.mockReturnValue({ ...base, ecran: null, pret: true });
    await render(<AppRoot />);
    await fireEvent.press(screen.getByText('Carte (sans compte)'));
    expect(screen.getByText('Connexion du personnel')).toBeTruthy();
    await fireEvent.press(screen.getByText('Connexion du personnel')); // retour
    expect(screen.getByText('Carte (sans compte)')).toBeTruthy();
  });

  it('un compte citoyen existant reste sur la carte ; une session du personnel ouvre son espace tout de suite', async () => {
    mockAcces.mockReturnValue({ ...base, ecran: 'citoyen', citoyen: { user_id: 'u', nom: 'A', courriel: 'a@b.ca' }, pret: false });
    const { rerender } = await render(<AppRoot />);
    expect(screen.getByText('Carte (compte citoyen)')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: 'superviseur', pret: false });
    await rerender(<AppRoot />);
    expect(screen.getByText('Coquille superviseur')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: 'employe', pret: true });
    await rerender(<AppRoot />);
    expect(screen.getByText('Coquille employé')).toBeTruthy();
  });
});
