import { render, screen } from '@testing-library/react-native';

import CarteCitoyen from '../../src/components/citoyen/ecran-carte';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/ville/selecteur-carte', () => ({ SelecteurCarte: () => null }));
jest.mock('@/components/ville/liste-endroits', () => ({ ListeEndroits: () => null }));
jest.mock('@/components/ville/reperes-endroits', () => ({ ReperesEndroits: () => null }));
const mockDessines: string[] = [];
jest.mock('@/components/carte', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Carte: ({ children }: { children: unknown }) => <View>{children as never}</View>,
    Repere: () => null,
    Cercle: ({ id }: { id: string }) => {
      mockDessines.push(id);
      return null;
    },
    Zone: ({ id }: { id: string }) => {
      mockDessines.push(id);
      return null;
    },
    Trace: () => null,
  };
});
jest.mock('@/hooks/use-couches', () => ({ useCouches: () => ({ couches: { grilles: { type: 'FeatureCollection', features: [] }, avisEau: { type: 'FeatureCollection', features: [] }, chantiers: { type: 'FeatureCollection', features: [] }, zonesInondables: { type: 'FeatureCollection', features: [] }, copieDu: '2026-11-20' } }) }));
jest.mock('@/hooks/use-source', () => ({ useSource: () => ({ etat: 'en_ligne' }) }));
const mockEtat: { chargement: boolean; erreur: string | null } = { chargement: true, erreur: null };
jest.mock('@/hooks/use-endroits', () => ({ useEndroits: () => ({ endroits: [], signalements: [], chargement: mockEtat.chargement, erreur: mockEtat.erreur, rafraichir: jest.fn() }) }));
jest.mock('@/hooks/use-bouches-existantes', () => ({ useBouchesExistantes: () => ({ bouches: [], surRegion: jest.fn() }) }));
jest.mock('@/hooks/use-regroupement', () => ({ useRegroupement: (_e: unknown, _r: unknown, _h: unknown, infos: unknown[] = []) => ({ regroupement: { groupes: [], isoles: [], infosIsolees: infos }, surRegion: jest.fn(), surTaille: jest.fn() }) }));
jest.mock('@/hooks/use-position-carte', () => ({ usePositionCarte: () => ({ position: null, statut: 'refusee', actualiser: jest.fn() }) }));
jest.mock('@/hooks/use-recherche-adresse', () => ({ MESSAGE_RECHERCHE_INDISPONIBLE: 'x', useRechercheAdresse: () => ({ chercher: async () => [], indisponible: false }) }));

describe('carte citoyen : affichée tout de suite', () => {
  it('pendant la lecture des signalements, la carte est là avec un indicateur discret', async () => {
    mockEtat.chargement = true;
    mockEtat.erreur = null;
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    expect(await screen.findByLabelText('Ma position : recentrer la carte')).toBeTruthy(); // la carte et ses commandes sont affichées
    expect(screen.getByText('Chargement des signalements…')).toBeTruthy();
    expect(screen.queryByText('Chargement de la carte…')).toBeNull();
  });

  it('en cas d’échec, un message avec Réessayer par-dessus la carte (pas à sa place)', async () => {
    mockEtat.chargement = false;
    mockEtat.erreur = 'Impossible de charger les signalements. Réessayez.';
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    expect(await screen.findByLabelText('Ma position : recentrer la carte')).toBeTruthy();
    expect(screen.getByText('Impossible de charger les signalements. Réessayez.')).toBeTruthy();
    expect(screen.getByLabelText('Réessayer')).toBeTruthy();
  });
});
