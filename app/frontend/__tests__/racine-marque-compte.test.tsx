import { act, render, screen } from '@testing-library/react-native';

import { lireMarque, reinitialiserMarque } from '../../src/marque/magasin';
import { organisationEmbarquee } from '../../src/marque/organisations-embarquees';

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
jest.mock('../admin/AdminApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille administration</Text> };
});
jest.mock('../StaffApp', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>Coquille employé</Text> };
});

let mockResoudre: (o: unknown) => void = () => {};
jest.mock('@/lib/organisations', () => {
  const actual = jest.requireActual('@/lib/organisations');
  return {
    ...actual,
    lireOrganisations: async () => ({ organisations: [], enBase: false }),
    abonnerOrganisations: () => () => {},
    lireMonOrganisation: () => new Promise((r) => (mockResoudre = r)),
  };
});

const base = { nom: 'Léa', equipeId: null, demoHorsLigne: false, deconnecter: async () => {}, citoyen: null, pret: true };

beforeEach(() => {
  reinitialiserMarque();
  mockAcces.mockReturnValue({ ...base, ecran: 'superviseur' });
});

describe('personnel : la marque du compte avant l’espace', () => {
  it('l’écran d’ouverture reste tant que la marque du compte n’est pas appliquée, puis l’espace s’affiche sous cette marque', async () => {
    await render(<AppRoot />);
    expect(screen.getByText('Ouverture de Priorix…')).toBeTruthy();
    expect(screen.getByText('Propulsé par Priorix')).toBeTruthy();
    expect(screen.queryByText('Coquille superviseur')).toBeNull();
    await act(async () => mockResoudre(organisationEmbarquee('montreal')));
    expect(await screen.findByText('Coquille superviseur')).toBeTruthy();
    expect(lireMarque().organisation.code).toBe('montreal');
  });

  it('plafond de 4 s : si la marque n’arrive pas, l’espace s’affiche sous la marque courante', async () => {
    jest.useFakeTimers();
    try {
      await render(<AppRoot />);
      expect(screen.queryByText('Coquille superviseur')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(4100);
      });
      expect(screen.getByText('Coquille superviseur')).toBeTruthy();
      expect(lireMarque().organisation.code).toBe('priorix');
    } finally {
      jest.useRealTimers();
    }
  });
});
