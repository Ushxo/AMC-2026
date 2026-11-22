import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Couches } from '../../src/types';
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
const mockCartePress: { f: ((c: { latitude: number; longitude: number }) => void) | null } = { f: null };
jest.mock('@/components/carte', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Carte: ({ children, onPress }: { children: unknown; onPress?: (c: { latitude: number; longitude: number }) => void }) => {
      mockCartePress.f = onPress ?? null;
      return <View>{children as never}</View>;
    },
    Repere: () => null,
    RepereInfo: ({ id, onPress, accessibilityLabel }: { id: string; onPress?: () => void; accessibilityLabel?: string }) => {
      const { Pressable } = jest.requireActual('react-native');
      return <Pressable testID={id} accessibilityLabel={accessibilityLabel} onPress={onPress} />;
    },
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
const carre = (lng: number, lat: number, d = 0.002): [number, number][] => [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
const avis = (id: string, type: 'ebullition' | 'coupure', lng: number) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [carre(lng, 45.5)] },
  properties: { id, origine: 'officiel', gravite: 'moyenne', type, titre: `Avis ${id}`, adresse: null, debut: '2026-11-20T10:00:00', fin: null, placement: 'geometrie_source' },
});
const mockCouches = {
  grilles: { type: 'FeatureCollection', features: [] },
  avisEau: { type: 'FeatureCollection', features: [avis('1', 'ebullition', -73.57), avis('2', 'coupure', -73.5)] },
  chantiers: { type: 'FeatureCollection', features: [] },
  zonesInondables: { type: 'FeatureCollection', features: [] },
  copieDu: '2026-11-20',
} as unknown as Couches;
jest.mock('@/hooks/use-couches', () => ({ useCouches: () => ({ couches: mockCouches }) }));
jest.mock('@/hooks/use-source', () => ({ useSource: () => ({ etat: 'en_ligne' }) }));
jest.mock('@/hooks/use-endroits', () => ({ useEndroits: () => ({ endroits: [], signalements: [], chargement: false, erreur: null, rafraichir: jest.fn() }) }));
jest.mock('@/hooks/use-bouches-existantes', () => ({ useBouchesExistantes: () => ({ bouches: [], surRegion: jest.fn() }) }));
jest.mock('@/hooks/use-regroupement', () => ({ useRegroupement: () => ({ regroupement: { groupes: [], isoles: [] }, surRegion: jest.fn(), surTaille: jest.fn() }) }));
jest.mock('@/hooks/use-position-carte', () => ({ usePositionCarte: () => ({ position: { latitude: 45.5, longitude: -73.5 }, statut: 'ok', actualiser: jest.fn() }) }));
jest.mock('@/hooks/use-recherche-adresse', () => ({
  MESSAGE_RECHERCHE_INDISPONIBLE: 'x',
  useRechercheAdresse: () => ({ chercher: async () => [{ libelle: '1 rue Test', position: { latitude: 45.5, longitude: -73.57 }, source: 'local' }], indisponible: false }),
}));

beforeEach(() => {
  mockDessines.length = 0;
});

describe('carte citoyen : avis d’eau et couches', () => {
  it('affiche les avis, distingue ébullition et coupures, et la position sous avis est dite', async () => {
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    expect(mockDessines.filter((i) => i.startsWith('avis-'))).toHaveLength(2);
    expect(screen.getByText("Votre position est sous un avis de coupure d'eau.")).toBeTruthy();
  });

  it('chaque couche se masque depuis les options, et la liste des avis ouvre la fiche', async () => {
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    await fireEvent.press(screen.getByLabelText('Options de la carte et liste des endroits'));
    await fireEvent(screen.getByLabelText("Coupures d'eau : affichée"), 'valueChange', false);
    await waitFor(() => expect(screen.getByLabelText("Coupures d'eau : masquée")).toBeTruthy());
    mockDessines.length = 0;
    await fireEvent(screen.getByLabelText("Avis d'ébullition : affichée"), 'valueChange', false);
    await waitFor(() => expect(screen.getByLabelText("Avis d'ébullition : masquée")).toBeTruthy());
    expect(screen.queryByLabelText(/Ouvrir la fiche/)).toBeNull(); // plus aucun avis affiché
    await fireEvent(screen.getByLabelText("Avis d'ébullition : masquée"), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText(/Avis d'ébullition : Avis 1\. Ouvrir la fiche/));
    expect(screen.getByText('Officiel (Ville de Montréal)')).toBeTruthy();
    expect(screen.getByText(/Données ouvertes de la Ville de Montréal, CC BY 4.0/)).toBeTruthy();
  });

  it('l’adresse cherchée dit si elle est sous avis', async () => {
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    await fireEvent.changeText(screen.getByLabelText('Rechercher une adresse à Montréal'), '1 rue Test');
    await fireEvent(screen.getByLabelText('Rechercher une adresse à Montréal'), 'submitEditing');
    await fireEvent.press(await screen.findByLabelText('Aller à 1 rue Test'));
    expect(screen.getByText("Cette adresse est sous un avis d'ébullition.")).toBeTruthy();
  });
});

describe('carte citoyen : repères d’information touchables', () => {
  it('chaque avis a son repère avec un libellé lu, qui ouvre la fiche', async () => {
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    const repere = await screen.findByTestId('info-avis-1');
    expect(repere.props.accessibilityLabel).toMatch(/^Avis d'ébullition, .*Ouvrir la fiche\.$/);
    expect(screen.getByTestId('info-avis-2')).toBeTruthy();
    const avant = screen.queryAllByText("Avis d'ébullition").length;
    await fireEvent.press(repere);
    expect(screen.queryAllByText("Avis d'ébullition").length).toBeGreaterThan(avant); // la fiche s'est ouverte
  });

  it('un toucher = une fiche : le repère puis l’écho de la carte n’ouvrent pas la feuille « Quel problème ? »', async () => {
    await render(<CarteCitoyen coquille={{ espaceBas: 0, onOpenProfile: jest.fn() }} />);
    const repere = await screen.findByTestId('info-avis-1');
    await fireEvent.press(repere);
    const apresPremier = screen.queryAllByText("Avis d'ébullition").length;
    await fireEvent.press(repere); // le tracé répond au même toucher : ignoré
    await act(async () => mockCartePress.f?.({ latitude: 45.9, longitude: -73.1 })); // la carte répond aussi, loin de tout avis
    expect(screen.queryByText('Quel problème avez-vous observé ?')).toBeNull();
    expect(screen.queryAllByText("Avis d'ébullition").length).toBe(apresPremier); // une seule fiche, rien d'autre ne s'est ouvert
  });
});
