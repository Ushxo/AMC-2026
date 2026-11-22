import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import StaffApp from '../StaffApp';
import { Colors } from '../../src/constants/theme';
import { COULEURS_IMPORTANCE } from '../../src/components/ville/style';
import { jetonsDepuis } from '../../src/marque/jetons';
import { appliquerMarquePersonnel, reinitialiserMarque, lireMarque } from '../../src/marque/magasin';
import { organisationEmbarquee } from '../../src/marque/organisations-embarquees';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Polyline: View, Marker: View, Circle: View, Polygon: View };
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
  }),
}));
jest.mock('@/hooks/use-tournees', () => ({ useTournees: () => ({ resultat: { tournees: [mockTournee], comparaison: null }, source: 'direct', chargement: false }) }));

// Couleurs propres à la marque Priorix : elles ne doivent apparaître nulle part sous la marque « montreal ».
// (Les couleurs de gravité, d'équipe, de tracé et de véhicule sont fixes par choix : elles ne sont pas dans cette liste.)
function couleursPriorixSeulement(): Set<string> {
  const priorix = organisationEmbarquee('priorix')!;
  const montreal = jetonsDepuis({ ...organisationEmbarquee('montreal')!.couleurs } as never);
  const propres = new Set<string>();
  const ajouter = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && propres.add(v.toLowerCase());
  Object.values(priorix.couleurs).forEach(ajouter);
  Object.values(Colors.light).forEach(ajouter);
  Object.values(Colors.dark).forEach(ajouter);
  Object.values(jetonsDepuis(priorix.couleurs as never)).forEach(ajouter);
  Object.values(montreal).forEach((v) => propres.delete(String(v).toLowerCase()));
  // Les couleurs d'importance (gravité) sont fixes par choix, même quand elles ressemblent à une couleur de marque.
  Object.values(COULEURS_IMPORTANCE).forEach((c) => Object.values(c).forEach((v) => propres.delete(String(v).toLowerCase())));
  return propres;
}

const CLES_COULEUR = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'tintColor', 'shadowColor'];

function collecter(noeud: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null, interdites: Set<string>, trouves: string[], chemin = ''): void {
  if (!noeud || typeof noeud === 'string') return;
  if (Array.isArray(noeud)) return noeud.forEach((n, i) => collecter(n, interdites, trouves, `${chemin}[${i}]`));
  const style = (StyleSheet.flatten(noeud.props?.style as never) ?? {}) as Record<string, unknown>;
  for (const k of CLES_COULEUR) {
    const v = style[k];
    if (typeof v === 'string' && interdites.has(v.toLowerCase())) trouves.push(`${chemin}/${noeud.type} ${k}=${v}`);
  }
  (noeud.children ?? []).forEach((c, i) => collecter(c as never, interdites, trouves, `${chemin}/${noeud.type}${i}`));
}

describe('marque de la Ville de Montréal côté employé', () => {
  beforeEach(() => {
    reinitialiserMarque();
    appliquerMarquePersonnel(organisationEmbarquee('montreal')!);
  });

  it('la coquille employé et le trajet n’affichent aucune couleur propre à Priorix', async () => {
    expect(lireMarque().organisation.code).toBe('montreal');
    const { toJSON } = await render(<StaffApp onLogout={() => {}} />);
    const trouves: string[] = [];
    collecter(toJSON() as never, couleursPriorixSeulement(), trouves);
    expect(trouves).toEqual([]);
  });

  it('la marque appliquée APRÈS le premier rendu recolore aussi l’écran déjà monté', async () => {
    reinitialiserMarque();
    appliquerMarquePersonnel(organisationEmbarquee('priorix')!);
    const { toJSON } = await render(<StaffApp onLogout={() => {}} />);
    await act(async () => appliquerMarquePersonnel(organisationEmbarquee('montreal')!));
    const trouves: string[] = [];
    collecter(toJSON() as never, couleursPriorixSeulement(), trouves);
    expect(trouves).toEqual([]);
  });

  it('les feuilles ouvertes par l’employé (profil, liste des arrêts) suivent aussi la marque', async () => {
    const { toJSON } = await render(<StaffApp onLogout={() => {}} />);
    const interdites = couleursPriorixSeulement();
    for (const ouvrir of [/Mon profil/, /Voir les \d+ arrêts/]) {
      await fireEvent.press(String(ouvrir).includes('profil') ? screen.getByLabelText(ouvrir) : screen.getByText(ouvrir));
      const trouves: string[] = [];
      collecter(toJSON() as never, interdites, trouves);
      expect({ ouvrir: String(ouvrir), trouves }).toEqual({ ouvrir: String(ouvrir), trouves: [] });
    }
  });
});
