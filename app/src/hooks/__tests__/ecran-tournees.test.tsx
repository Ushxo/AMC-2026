import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Tournees from '../../app/ville/tournees';
import * as optimisation from '../../lib/optimisation';
import * as source from '../../lib/source';
import { definirEmploye } from '../../lib/session';
import { reinitialiserEtatTournees } from '../../lib/store-tournees';
import { getSupabase } from '../../lib/supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  const Faux = ({ children }: { children?: unknown }) => <View>{children as never}</View>;
  return { __esModule: true, default: Faux, Marker: Faux, Polyline: Faux, Circle: Faux, Polygon: Faux };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children }: { children?: unknown }) => <View>{children as never}</View>,
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  };
});
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Stack: { Screen: () => null },
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    Link: ({ children }: { children?: unknown }) => <View>{children as never}</View>,
  };
});
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/source', () => ({
  etatSource: jest.fn(),
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
  creerDemande: jest.fn(),
  lireDemande: jest.fn(async () => null),
  lireDerniereTerminee: jest.fn(async () => null),
  abonnerDemandes: jest.fn(() => () => {}),
}));

const s = source as unknown as Record<string, jest.Mock>;
const o = optimisation as unknown as Record<string, jest.Mock>;

async function vider() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  o.lireDerniereTerminee.mockReset().mockResolvedValue(null);
  o.creerDemande.mockReset();
  const eq0 = jest.requireMock('../../lib/equipes') as Record<string, jest.Mock>;
  eq0.lireEquipes.mockReset().mockResolvedValue([]);
  eq0.lireIncidents.mockReset().mockResolvedValue([]);
  reinitialiserEtatTournees();
  definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
  (getSupabase as jest.Mock).mockReturnValue(null);
});

const clientFaux = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({}),
  },
};

const equipeBase = {
  id: 'e1', nom: 'Équipe 1', membres: [], vehicule: null, garage: { latitude: 45.51, longitude: -73.57 },
  debut_quart: '07:00', fin_quart: '14:00', active: true, exemple_demo: false,
};

function resultatDirect(avecIncident: boolean, tournees = 1) {
  return {
    version: 1, demande_id: 'd1', statut: 'terminee', message: null, calcule_le: '2026-11-21T20:00:00Z',
    duree_calcul_ms: 0, source_matrice: 'osrm_cache', precalcule: false,
    incidents: avecIncident ? [{ id: 'i1', type: 'rue_fermee', position: { latitude: 45.5, longitude: -73.57 }, rayon_m: 100, simule: true }] : [],
    tournees: Array.from({ length: tournees }, (_, k) => ({
      id: `t${k}`, equipe_id: k === 0 ? 'e1' : 'inconnue', equipe_nom: 'Équipe', distance_m: 1000, duree_s: 3600,
      debut_prevu: '2026-11-22T12:00:00+00:00', fin_prevue: '2026-11-22T18:00:00+00:00', geometrie: null,
      arrets: [{ rang: 1, cle_endroit: 'grille:1', signalement_ids: ['s1'], position: { latitude: 45.5, longitude: -73.57 }, arrivee_prevue: '2026-11-22T12:10:00+00:00', depart_prevu: '2026-11-22T12:18:00+00:00' }],
    })),
    non_servis: [],
    comparaison: {
      ordre_arrivee: { distance_m: 2000, duree_s: 7200, arrets_servis: 1, depassement_quart_s: 0 },
      optimise: { distance_m: 1000, duree_s: 3600, arrets_servis: 1 },
      gain_distance_m: 1000, gain_duree_s: 3600,
      dans_le_quart: { ordre_arrivee: 1, optimise: 1, arrets_en_plus: 0 },
    },
  };
}

describe("l'écran des tournées ne plante jamais", () => {
  it('hors ligne : Optimiser, ajouter et retirer l’incident, dans plusieurs ordres', async () => {
    s.etatSource.mockReturnValue('repli');
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Optimiser'));
    await vider();
    await fireEvent.press(screen.getByText('Ajouter un incident simulé'));
    await vider();
    expect(screen.getByText(/Résultat précalculé avec l/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Retirer l'incident"));
    await vider();
    await fireEvent.press(screen.getByText('Ajouter un incident simulé'));
    await vider();
    await fireEvent.press(screen.getByText("Retirer l'incident"));
    await fireEvent.press(screen.getByText('Optimiser'));
    await vider();
    expect(screen.getByText(/Tournées du dimanche 22 novembre/)).toBeTruthy();
  });

  it.each([
    ['sans équipe lisible', []],
    ['avec des équipes', [equipeBase]],
  ])('en ligne, résultat direct, %s : bascule sur le précalculé et retour, incident ajouté et retiré', async (_nom, equipes) => {
    s.etatSource.mockReturnValue('en_ligne');
    (getSupabase as jest.Mock).mockReturnValue(clientFaux);
    o.lireDerniereTerminee.mockResolvedValue(resultatDirect(true, 2));
    const eq = jest.requireMock('../../lib/equipes') as Record<string, jest.Mock>;
    eq.lireEquipes.mockResolvedValue(equipes);
    eq.lireIncidents.mockResolvedValue([{ id: 'i1', type: 'rue_fermee', position: { latitude: 45.5, longitude: -73.57 }, rayon_m: 100, description: null, actif: true, simule: true, cree_le: 'x' }]);
    o.creerDemande.mockResolvedValue({ erreur: 'Le calcul des tournées a échoué. Réessayez.' });
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Optimiser'));
    await vider();
    expect(screen.getByText('Le calcul des tournées a échoué. Réessayez.')).toBeTruthy();
    await fireEvent.press(screen.getByText("Retirer l'incident"));
    await vider();
    // Bascule sur le précalculé (par exemple après le délai), puis retour au résultat direct.
    const store = jest.requireActual('../../lib/store-tournees');
    await act(async () => {
      store.modifierEtatTournees({ forcerPrecalcule: true });
    });
    await act(async () => {
      store.modifierEtatTournees({ incidentDemo: true });
    });
    await act(async () => {
      store.modifierEtatTournees({ forcerPrecalcule: false, incidentDemo: false });
    });
    await vider();
    expect(screen.getByText(/Tournées du/)).toBeTruthy();
  });

  it('en ligne sans aucun résultat et sans équipe : message vide, pas de plantage', async () => {
    s.etatSource.mockReturnValue('en_ligne');
    (getSupabase as jest.Mock).mockReturnValue(clientFaux);
    await render(<Tournees />);
    await vider();
    expect(screen.getByText(/Aucune tournée pour le moment/)).toBeTruthy();
  });

  it('création de demande refusée par la base (employé sans droit) : message lisible', async () => {
    s.etatSource.mockReturnValue('en_ligne');
    (getSupabase as jest.Mock).mockReturnValue(clientFaux);
    o.creerDemande.mockResolvedValue(undefined); // forme inattendue : rien ne revient
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Optimiser'));
    await vider();
    expect(screen.getByText('Le calcul des tournées a échoué. Réessayez.')).toBeTruthy();
  });
});

describe("données mal formées : jamais d'exception de rendu", () => {
  async function afficher(direct: unknown, equipes: unknown[] = []) {
    s.etatSource.mockReturnValue('en_ligne');
    (getSupabase as jest.Mock).mockReturnValue(clientFaux);
    o.lireDerniereTerminee.mockResolvedValue(direct);
    const eq = jest.requireMock('../../lib/equipes') as Record<string, jest.Mock>;
    eq.lireEquipes.mockResolvedValue(equipes);
    await render(<Tournees />);
    await vider();
  }

  it('incident undefined, tournée vide, arrêt sans position, équipe undefined', async () => {
    const r = resultatDirect(true, 2) as unknown as { incidents: unknown[]; tournees: { arrets: unknown[] }[] };
    r.incidents.push(undefined, null, { type: 'autre' });
    r.tournees.push(undefined as never, null as never, { equipe_id: 'x' } as never);
    r.tournees[0].arrets.push(undefined, { rang: 2 }, { rang: 3, position: { latitude: NaN, longitude: 1 } });
    await afficher(r, [undefined, equipeBase, null]);
    expect(screen.getByText(/Tournées du/)).toBeTruthy();
  });

  it('comparaison absente ou à l’ancien format : gain à zéro, sans exception', async () => {
    for (const comparaison of [undefined, null, { gain: 1 }, { ordre_arrivee: null, optimise: null }]) {
      const r = { ...resultatDirect(false), comparaison } as never;
      await afficher(r);
      expect(screen.getAllByText(/Kilomètres en moins : 0,0 km/).length).toBeGreaterThan(0);
    }
  });

  it('résultat inutilisable : message « aucune tournée »', async () => {
    await afficher({ tournees: 'pas une liste' });
    expect(screen.getByText(/Aucune tournée pour le moment/)).toBeTruthy();
    await afficher({});
    await afficher(undefined);
  });

  it('hors ligne : deux appuis rapides sur « Retirer l’incident » ne plantent pas', async () => {
    s.etatSource.mockReturnValue('repli');
    await render(<Tournees />);
    await vider();
    await fireEvent.press(screen.getByText('Ajouter un incident simulé'));
    await vider();
    const retirer = screen.getByText("Retirer l'incident");
    await fireEvent.press(retirer);
    await fireEvent.press(retirer);
    await vider();
    // Le même bouton change de rôle après le premier appui : le second appui rejoue l'autre action. Aucune exception.
    expect(screen.queryByText("Retirer l'incident") ?? screen.queryByText('Ajouter un incident simulé')).toBeTruthy();
  });
});
