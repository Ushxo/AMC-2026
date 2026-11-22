import { render, screen } from '@testing-library/react-native';

import StaffApp from '../StaffApp';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const mockEquipe = jest.fn();
jest.mock('@/hooks/use-mon-equipe', () => ({ useMonEquipe: () => mockEquipe() }));
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => ({ nom: 'Équipe 1 compte' }) }));
jest.mock('@/app/ville/trajet/[equipe]', () => {
  const { Text } = jest.requireActual('react-native');
  return { EcranTrajet: ({ equipe }: { equipe?: string }) => <Text>Trajet de {equipe}</Text> };
});

describe('espace employé : Ma carte', () => {
  it('recherche de l’équipe, puis le trajet de l’équipe du compte', async () => {
    mockEquipe.mockReturnValue({ equipeId: null, chargement: true });
    const { rerender } = await render(<StaffApp onLogout={() => {}} />);
    expect(screen.getByText('Recherche de votre équipe…')).toBeTruthy();
    mockEquipe.mockReturnValue({ equipeId: 'eq-1', chargement: false });
    await rerender(<StaffApp onLogout={() => {}} />);
    expect(screen.getByText('Trajet de eq-1')).toBeTruthy();
    expect(screen.getByText(/Ma carte · Équipe 1 compte/)).toBeTruthy();
  });

  it('compte sans équipe : explique quoi faire', async () => {
    mockEquipe.mockReturnValue({ equipeId: null, chargement: false });
    await render(<StaffApp onLogout={() => {}} />);
    expect(screen.getByText('Aucune équipe associée à ce compte')).toBeTruthy();
    expect(screen.getByText(/Demandez au superviseur/)).toBeTruthy();
  });
});
