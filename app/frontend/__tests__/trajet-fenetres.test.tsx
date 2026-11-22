import { act, fireEvent, render, screen } from '@testing-library/react-native';

import StaffApp from '../StaffApp';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-maps', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  class Carte extends React.Component<{ children?: unknown }> {
    animateCamera() {}
    animateToRegion() {}
    render() {
      return <View>{this.props.children as never}</View>;
    }
  }
  return { __esModule: true, default: Carte, Polyline: View, Marker: View, Circle: View, Polygon: View };
});
jest.mock('@/components/carte', () => {
  const { View } = jest.requireActual('react-native');
  const Nul = () => null;
  return {
    Carte: ({ children }: { children?: unknown }) => <View>{children as never}</View>,
    Repere: Nul, RepereGroupe: Nul, Vehicule: Nul, Trace: Nul, Zone: Nul, Cercle: Nul,
    NAVIGATION_GOOGLE: false,
  };
});
jest.mock('@/components/carte/navigation-google', () => ({ NAVIGATION_GOOGLE: false, NavigationGoogle: () => null }));
jest.mock('@/hooks/use-mon-equipe', () => ({ useMonEquipe: () => ({ equipeId: 'e1', chargement: false }) }));
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => ({ nom: 'Équipe 1' }) }));
jest.mock('@/hooks/use-source', () => ({ useSource: () => ({ etat: 'en_ligne' }) }));
jest.mock('@/hooks/use-session-employe', () => ({ useSessionEmploye: () => ({ peutGerer: false, demoHorsLigne: false }) }));
jest.mock('@/hooks/use-optimisation', () => ({ useOptimisation: () => ({ lancer: jest.fn(), demande: null, enCours: false, basculeSurPrecalcule: false, message: null }) }));
jest.mock('@/hooks/use-positions-equipes', () => ({ usePositionsEquipes: () => ({ positions: [], disponible: false }) }));
jest.mock('@/hooks/use-position-suivie', () => ({ usePositionSuivie: () => ({ position: { latitude: 45.5, longitude: -73.57 }, cap: 0 }) }));
jest.mock('@/hooks/use-trace-tournee', () => ({ useTraceTournee: () => [] }));
jest.mock('@/hooks/use-troncon', () => ({ useTroncon: () => null }));
jest.mock('@/hooks/use-endroits', () => ({ useEndroits: () => ({ endroits: [], signalements: [], chargement: false }) }));
jest.mock('@/hooks/use-equipes', () => ({
  useEquipes: () => ({ equipes: [{ id: 'e1', nom: 'Équipe Nord', garage: { latitude: 45.5, longitude: -73.57 }, arrivee: null }], chargement: false }),
}));
const arret = (rang: number, fait = false) => ({
  rang, cle_endroit: `c${rang}`, signalement_ids: ['s'], position: { latitude: 45.5 + rang / 1000, longitude: -73.57 },
  arrivee_prevue: '2026-11-22T12:00:00Z', depart_prevu: '2026-11-22T12:10:00Z', fait,
});
const mockArrets = [arret(1, true), arret(2), arret(3)];
const mockTournee = { equipe_id: 'e1', equipe_nom: 'Équipe Nord', distance_m: 4000, duree_s: 1800, debut_prevu: '2026-11-22T12:00:00Z', fin_prevue: '2026-11-22T13:00:00Z', geometrie: null, arrets: mockArrets };
jest.mock('@/hooks/use-suivi-trajet', () => ({
  useSuiviTrajet: () => ({
    tournee: mockTournee, arrets: mockArrets, prochain: mockArrets[1], courant: mockArrets[1], faits: 1, total: 3, position: null, local: false,
    estFait: (a: { fait?: boolean }) => !!a.fait, estPartiel: () => false, aller: jest.fn(), reordonnerDepuis: jest.fn(), ordreLocal: false,
    marquerFait: jest.fn(), terminee: false, chargement: false,
    estNonFait: () => false, estTraite: (a: { fait?: boolean }) => !!a.fait, statut: (a: { fait?: boolean }) => (a.fait ? 'fait' : null),
    commentaire: () => null, traites: 1, nonFaits: 0, enregistrerResultat: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-tournees', () => ({ useTournees: () => ({ resultat: { tournees: [mockTournee], comparaison: null }, source: 'direct', chargement: false }) }));


describe('liste des arrêts puis feuille de résultat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('la feuille de résultat s’ouvre seulement après la fermeture de la liste (jamais deux fenêtres en même temps)', async () => {
    await render(<StaffApp onLogout={() => {}} />);
    await fireEvent.press(screen.getByText(/Voir les \d+ arrêts/));
    expect(screen.getByLabelText('Fermer la liste')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Arrêt 2, .*Donner ou corriger/));
    expect(screen.queryByLabelText('Fermer sans enregistrer')).toBeNull(); // pas encore : la liste se ferme
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByLabelText('Fermer sans enregistrer')).toBeTruthy();
  });
});
