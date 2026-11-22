import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, fondDeLaRacine, textesIllisibles } from '../aide-tests/lisibilite';
import { lireMarque, reinitialiserMarque } from '../../src/marque/magasin';
import { render, screen, waitFor } from '@testing-library/react-native';

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

describe('lisibilité sous chaque thème (admin)', () => {
  beforeEach(() => {
    reinitialiserMarque();
    mockLister.mockResolvedValue({ complete: true, comptes: [{ id: 'u1', courriel: 'lea@ville.ca', role: 'employe', poste: 'commis', nom: 'Léa Roy', organisation: 'Priorix', equipe: 'Équipe 1', creeLe: null }] });
  });
  it.each(COMBINAISONS_THEMES)('thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    const rendu = await render(<AdminApp onLogout={jest.fn()} />);
    await waitFor(() => expect(rendu.toJSON()).not.toBeNull());
    expect(await screen.findByText('Léa Roy')).toBeTruthy();
    expect(textesIllisibles()).toEqual([]);
    expect(fondDeLaRacine()).toBe(lireMarque().jetons.background); // l'écran pose lui-même le fond du thème
  });
});
