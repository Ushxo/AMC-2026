import { render, screen } from '@testing-library/react-native';

import AppRoot from '../AppRoot';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockAcces = jest.fn();
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => mockAcces() }));
jest.mock('../auth/AuthFlow', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Écran de connexion</Text> };
});
jest.mock('../citizen/CitizenApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille citoyen</Text> };
});
jest.mock('../supervisor/SupervisorApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille superviseur</Text> };
});
jest.mock('../StaffApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille employé</Text> };
});

const base = { nom: null, citoyen: null, equipeId: null, demoHorsLigne: false, deconnecter: async () => {} };

describe('racine de l’app', () => {
  it('attend la reprise de la session, puis montre la connexion sans session', async () => {
    mockAcces.mockReturnValue({ ...base, ecran: null, pret: false });
    const { rerender } = await render(<AppRoot />);
    expect(screen.getByText('Ouverture de Priorix…')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: null, pret: true });
    await rerender(<AppRoot />);
    expect(screen.getByText('Écran de connexion')).toBeTruthy();
  });

  it('ouvre la coquille du rôle, même si la reprise n’est pas finie', async () => {
    mockAcces.mockReturnValue({ ...base, ecran: 'citoyen', pret: false });
    const { rerender } = await render(<AppRoot />);
    expect(screen.getByText('Coquille citoyen')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: 'superviseur', pret: true });
    await rerender(<AppRoot />);
    expect(screen.getByText('Coquille superviseur')).toBeTruthy();
    mockAcces.mockReturnValue({ ...base, ecran: 'employe', pret: true });
    await rerender(<AppRoot />);
    expect(screen.getByText('Coquille employé')).toBeTruthy();
  });
});
