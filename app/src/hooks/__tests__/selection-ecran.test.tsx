import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Tournees from '../../app/ville/tournees';
import { definirEmploye } from '../../lib/session';
import * as source from '../../lib/source';
import { reinitialiserEtatTournees } from '../../lib/store-tournees';
import { sig } from '../../lib/test-utils/fabrique';
import { getSupabase } from '../../lib/supabase';

const mockLancer = jest.fn(async (_p?: unknown) => null as string | null);

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  const Faux = ({ children }: { children?: unknown }) => <View>{children as never}</View>;
  return { __esModule: true, default: Faux, Marker: Faux, Polyline: Faux, Circle: Faux, Polygon: Faux, UrlTile: Faux };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children }: { children?: unknown }) => <View>{children as never}</View>,
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  };
});
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/source', () => ({
  etatSource: jest.fn(() => 'repli'),
  abonnerEtat: jest.fn(() => () => {}),
  abonnerChangements: jest.fn(() => () => {}),
  abonnerSignalementsRealtime: jest.fn(() => () => {}),
  sonderSource: jest.fn(async () => 'repli'),
  lireSignalements: jest.fn(async () => []),
  renvoyerFile: jest.fn(async () => 0),
  avecDelai: (p: PromiseLike<unknown>) => Promise.resolve(p),
}));
jest.mock('../../lib/file-attente', () => ({ lister: jest.fn(async () => []) }));
jest.mock('../../lib/equipes', () => ({
  ...jest.requireActual('../../lib/equipes'),
  lireEquipes: jest.fn(async () => []),
  lireIncidents: jest.fn(async () => []),
}));
jest.mock('../../lib/optimisation', () => ({
  ...jest.requireActual('../../lib/optimisation'),
  lireDemande: jest.fn(async () => null),
  lireDerniereTerminee: jest.fn(async () => null),
  abonnerDemandes: jest.fn(() => () => {}),
}));
jest.mock('../use-optimisation', () => ({
  useOptimisation: () => ({
    lancer: mockLancer,
    demande: null,
    enCours: false,
    basculeSurPrecalcule: false,
    message: null,
  }),
}));

const s = source as unknown as Record<string, jest.Mock>;

async function vider() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  reinitialiserEtatTournees();
  definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
  (getSupabase as jest.Mock).mockReturnValue(null);
  s.etatSource.mockReturnValue('repli');
  s.lireSignalements.mockResolvedValue([
    sig({ latitude: 45.50, longitude: -73.57, gravite: 'elevee' }),
    sig({ latitude: 45.51, longitude: -73.58, gravite: 'elevee' }),
    sig({ latitude: 45.52, longitude: -73.59, gravite: 'moyenne' }),
    sig({ latitude: 45.53, longitude: -73.60, gravite: 'faible' }),
  ]);
});

describe('sélection des endroits sur l’écran des tournées', () => {
  it('tout est sélectionné au départ, le compteur le dit, et Optimiser envoie tout (sans liste)', async () => {
    await render(<Tournees />);
    await vider();
    expect(screen.getByText('4 endroits sélectionnés (2 élevés, 1 moyen, 1 faible)')).toBeTruthy();
    await fireEvent.press(screen.getByText(/Calculer le trajet optimal|Relancer le calcul/));
    await vider();
    expect(mockLancer).toHaveBeenCalledTimes(1);
    expect(mockLancer.mock.calls[0][0]).not.toHaveProperty('cles_endroits');
  });

  it('un bouton de gravité retire puis remet tout un niveau ; Optimiser envoie la sélection', async () => {
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByLabelText(/Gravité Élevée, 2 endroits/));
    await vider();
    expect(screen.getByText('2 endroits sélectionnés (0 élevé, 1 moyen, 1 faible)')).toBeTruthy();
    await fireEvent.press(screen.getByText(/Calculer le trajet optimal|Relancer le calcul/));
    await vider();
    const params = mockLancer.mock.calls[0][0] as { cles_endroits: string[] };
    expect(params.cles_endroits).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText(/Gravité Élevée, 2 endroits/));
    await vider();
    expect(screen.getByText('4 endroits sélectionnés (2 élevés, 1 moyen, 1 faible)')).toBeTruthy();
  });

  it('« Tout retirer » désactive Optimiser avec une explication, « Tout sélectionner » le réactive', async () => {
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Tout retirer'));
    await vider();
    expect(screen.getByText('0 endroit sélectionné (0 élevé, 0 moyen, 0 faible)')).toBeTruthy();
    expect(screen.getAllByText('Sélectionnez au moins un endroit.').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText(/Calculer le trajet optimal|Relancer le calcul/));
    await vider();
    expect(mockLancer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Tout sélectionner'));
    await vider();
    await fireEvent.press(screen.getByText(/Calculer le trajet optimal|Relancer le calcul/));
    await vider();
    expect(mockLancer).toHaveBeenCalledTimes(1);
  });

  it('la liste de secours permet de choisir un endroit sans la carte, avec l’état « coché »', async () => {
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Tout retirer'));
    await fireEvent.press(screen.getByText('Afficher la liste des endroits'));
    await vider();
    const lignes = screen.getAllByRole('checkbox');
    expect(lignes).toHaveLength(4);
    expect(lignes[0].props.accessibilityState.checked).toBe(false);
    await fireEvent.press(lignes[0]);
    await vider();
    expect(screen.getAllByRole('checkbox')[0].props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('1 endroit sélectionné (1 élevé, 0 moyen, 0 faible)')).toBeTruthy();
  });

  it('hors ligne, l’écran dit que le résultat précalculé couvre tous les endroits', async () => {
    await render(<Tournees />);
    await vider();
    expect(screen.getAllByText('Résultat précalculé sur tous les endroits.').length).toBeGreaterThan(0);
  });
});
