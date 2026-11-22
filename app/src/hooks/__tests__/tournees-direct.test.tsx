import { act, render, screen } from '@testing-library/react-native';

import Tournees from '../../app/ville/tournees';
import { definirEmploye } from '../../lib/session';
import { reinitialiserEtatTournees } from '../../lib/store-tournees';
import { getSupabase } from '../../lib/supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));
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


const ID_EQUIPES = ['11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000004'];

function construireBase(variante: 'normale' | 'ancienneComparaison' | 'parametresNuls' | 'incidentRetire') {
  const demandes: Ligne[] = Array.from({ length: 14 }, (_, k) => ({
    id: `d${String(k).padStart(2, '0')}`, cree_le: `2026-11-21T1${k % 10}:00:00+00:00`, cree_par: null,
    statut: k === 3 ? 'remplacee' : 'terminee', parametres: k % 2 ? { version: 1, limite_secondes: 8 } : { version: 1, date: '2026-11-22', limite_secondes: 8 },
    message: null, commence_le: `2026-11-21T1${k % 10}:00:01+00:00`, termine_le: `2026-11-21T1${k % 10}:00:20+00:00`,
    comparaison: k === 5 ? null : { ordre_arrivee: { distance_m: 2000, duree_s: 7200, arrets_servis: 4, depassement_quart_s: 10 }, optimise: { distance_m: 1000, duree_s: 3600, arrets_servis: 4 }, gain_distance_m: 1000, gain_duree_s: 3600, dans_le_quart: { ordre_arrivee: 3, optimise: 4, arrets_en_plus: 1 } },
    non_servis: [{ cle_endroit: 'grille:9', gravite: 'faible', raison: 'temps du quart dépassé' }],
    source_matrice: 'osrm_cache',
  }));
  const derniere = demandes[13];
  derniere.termine_le = '2026-11-21T23:59:59+00:00';
  if (variante === 'ancienneComparaison') derniere.comparaison = { gain: { distance_gagnee_m: 5 }, ordre_arrivee: { distance_m: 9 } };
  if (variante === 'parametresNuls') derniere.parametres = null;
  if (variante === 'incidentRetire') derniere.parametres = { version: 1, incident_ids: ['inc-retire'] };
  const tournees: Ligne[] = ID_EQUIPES.map((e, k) => ({
    id: `t${k}`, demande_id: derniere.id, equipe_id: e, distance_m: 1000 * (k + 1), duree_s: 20000,
    debut_prevu: '2026-11-22T12:00:00+00:00', fin_prevue: '2026-11-22T18:59:44+00:00', geometrie: k % 2 ? null : { type: 'LineString', coordinates: [[-73.57, 45.5], [-73.56, 45.51]] },
  }));
  const arrets: Ligne[] = tournees.flatMap((t, k) => [1, 2, 3].map((rang) => ({
    id: `a${k}${rang}`, tournee_id: t.id, demande_id: derniere.id, rang, cle_endroit: `grille:${k}${rang}`,
    signalement_ids: [`s${k}${rang}`], latitude: 45.5 + k / 1000, longitude: -73.57, arrivee_prevue: '2026-11-22T12:10:00+00:00',
    depart_prevu: '2026-11-22T12:18:00+00:00', fait: false, fait_le: null,
  })));
  const equipes: Ligne[] = ID_EQUIPES.map((id, k) => ({
    id, nom: `Équipe ${k + 1}`, membres: [], vehicule: k ? null : 'Camion', garage_latitude: 45.5, garage_longitude: -73.57,
    garage_nom: k % 2 ? null : 'Garage simulé', debut_quart: '07:00:00', fin_quart: '14:00:00', active: true, exemple_demo: true, cree_le: `2026-11-21T0${k}:00:00+00:00`,
  }));
  return { demandes_optimisation: demandes, tournees, arrets, equipes, incidents: [] as Ligne[] };
}

let snap: ReturnType<typeof construireBase>;
type Ligne = Record<string, unknown>;

/** Imite le constructeur de requêtes de PostgREST sur les vraies lignes. */
function table(nom: string) {
  let lignes: Ligne[] = [...((snap as unknown as Record<string, Ligne[]>)[nom] ?? [])];
  const b: Record<string, unknown> = {};
  const resultat = () => ({ data: lignes, error: null });
  Object.assign(b, {
    select: () => b,
    eq: (c: string, v: unknown) => { lignes = lignes.filter((l) => l[c] === v); return b; },
    in: (c: string, v: unknown[]) => { lignes = lignes.filter((l) => v.includes(l[c])); return b; },
    contains: () => b,
    order: (c: string, o?: { ascending?: boolean }) => {
      const asc = o?.ascending !== false;
      lignes = [...lignes].sort((x, y) => (String(x[c]) < String(y[c]) ? -1 : 1) * (asc ? 1 : -1));
      return b;
    },
    limit: (n: number) => { lignes = lignes.slice(0, n); return b; },
    maybeSingle: async () => ({ data: lignes[0] ?? null, error: null }),
    single: async () => ({ data: lignes[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko),
  });
  return b;
}

const clientReel = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({}),
  },
  from: (nom: string) => table(nom),
  rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'absente' } }),
  channel: () => {
    const c = { on: () => c, subscribe: () => c };
    return c;
  },
  removeChannel: async () => 'ok',
};



async function afficher(variante: Parameters<typeof construireBase>[0], role: 'admin' | 'superviseur' | 'employe') {
  snap = construireBase(variante);
  (getSupabase as jest.Mock).mockReturnValue(clientReel);
  reinitialiserEtatTournees();
  definirEmploye({ user_id: 'u', nom: 'Compte', courriel: 'a@b.ca' }, role);
  await render(<Tournees />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
}

describe('chemin direct : lignes de la base lues comme par un vrai compte', () => {
  it.each(['admin', 'superviseur', 'employe'] as const)('rôle %s, 14 demandes dont une remplacée : tournées affichées', async (role) => {
    await afficher('normale', role);
    expect(screen.getByText(/Tournées du dimanche 22 novembre/)).toBeTruthy();
    expect(screen.queryByText(/Hors ligne/)).toBeNull();
  });

  it('comparaison à l’ancienne forme dans la dernière demande : gain à zéro, sans exception', async () => {
    await afficher('ancienneComparaison', 'admin');
    expect(screen.getByText(/Tournées du/)).toBeTruthy();
  });

  it('parametres nul dans la dernière demande', async () => {
    await afficher('parametresNuls', 'admin');
    expect(screen.getByText(/Tournées du/)).toBeTruthy();
  });

  it('incident enregistré avec la demande mais retiré de la base : pas d’incident, pas d’exception', async () => {
    await afficher('incidentRetire', 'admin');
    expect(screen.getByText(/Tournées du/)).toBeTruthy();
    expect(screen.queryByText(/Incident simulé/)).toBeNull();
  });
});
