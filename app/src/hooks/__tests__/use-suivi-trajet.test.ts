import { act, renderHook } from '@testing-library/react-native';

import { MESSAGE_ARRET_ECHEC, MESSAGE_ARRET_FAIT_PARTIEL } from '../../lib/messages';
import * as trajet from '../../lib/trajet';
import type { Arret, ResultatOptimisation, Signalement } from '../../types';
import { useSuiviTrajet } from '../use-suivi-trajet';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockChanger = jest.fn();
const mockRafraichir = jest.fn(async () => {});
let mockResultat: ResultatOptimisation | null = null;
let mockDemo = false;
let mockSignalements: Pick<Signalement, 'id' | 'etat'>[] = [];

jest.mock('../use-tournees', () => ({
  useTournees: () => ({ resultat: mockResultat, chargement: false, rafraichir: mockRafraichir }),
}));
jest.mock('../use-session-employe', () => ({ useSessionEmploye: () => ({ demoHorsLigne: mockDemo }) }));
jest.mock('../use-position', () => ({ usePosition: () => ({ position: { latitude: 45.5, longitude: -73.56 } }) }));
jest.mock('../use-signalements', () => ({ useSignalements: () => ({ signalements: mockSignalements }) }));
jest.mock('../use-changer-etat', () => ({ useChangerEtat: () => ({ changer: mockChanger }) }));
jest.mock('../../lib/trajet', () => ({ ...jest.requireActual('../../lib/trajet'), ecrireArretFait: jest.fn() }));

const ecrire = trajet.ecrireArretFait as jest.Mock;

function arret(rang: number, extra: Partial<Arret> = {}): Arret {
  return {
    rang, cle_endroit: `grille:${rang}`, signalement_ids: [`s${rang}a`, `s${rang}b`],
    position: { latitude: 45.5, longitude: -73.56 },
    arrivee_prevue: '2026-11-22T12:00:00+00:00', depart_prevu: '2026-11-22T12:05:00+00:00', ...extra,
  };
}

function resultat(arrets: Arret[]): ResultatOptimisation {
  return {
    tournees: [{ equipe_id: 'e1', equipe_nom: 'Équipe 1', distance_m: 1, duree_s: 1, debut_prevu: '', fin_prevue: '', geometrie: null, arrets }],
  } as unknown as ResultatOptimisation;
}

beforeEach(() => {
  jest.clearAllMocks();
  trajet.reinitialiserTrajet();
  mockDemo = false;
  mockChanger.mockReset().mockResolvedValue(null);
  ecrire.mockReset().mockResolvedValue(true);
  mockSignalements = [
    { id: 's1a', etat: 'nouveau' }, { id: 's1b', etat: 'regle' },
    { id: 's2a', etat: 'pris_en_charge' }, { id: 's2b', etat: 'nouveau' },
  ];
});

describe('useSuiviTrajet', () => {
  it('en base : écrit l’arrêt, passe à réglé les signalements ouverts seulement, rafraîchit', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' }), arret(2, { id: 'A2' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    expect(result.current.total).toBe(2);
    expect(result.current.prochain?.rang).toBe(1);
    let reponse: string | null = 'x';
    await act(async () => {
      reponse = await result.current.marquerFait('A1');
    });
    expect(reponse).toBeNull();
    expect(ecrire).toHaveBeenCalledWith('A1');
    expect(mockChanger).toHaveBeenCalledTimes(1); // s1b est déjà réglé
    expect(mockChanger).toHaveBeenCalledWith('s1a', 'regle');
    expect(mockRafraichir).toHaveBeenCalled();
    expect(result.current.faits).toBe(1);
    expect(result.current.prochain?.rang).toBe(2);
    expect(result.current.terminee).toBe(false);
  });

  it('si la base refuse l’arrêt : message, rien n’est réglé', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' })]);
    ecrire.mockResolvedValue(false);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    let reponse: string | null = null;
    await act(async () => {
      reponse = await result.current.marquerFait('A1');
    });
    expect(reponse).toBe(MESSAGE_ARRET_ECHEC);
    expect(mockChanger).not.toHaveBeenCalled();
    expect(result.current.faits).toBe(0);
  });

  it('si les signalements échouent après l’arrêt : on le dit et on peut réessayer sans réécrire l’arrêt', async () => {
    mockResultat = resultat([arret(2, { id: 'A2' })]);
    mockChanger.mockResolvedValueOnce(null).mockResolvedValueOnce('refus');
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    let reponse: string | null = null;
    await act(async () => {
      reponse = await result.current.marquerFait('A2');
    });
    expect(reponse).toBe(MESSAGE_ARRET_FAIT_PARTIEL);
    expect(result.current.estPartiel(result.current.arrets[0])).toBe(true);
    expect(result.current.terminee).toBe(false);
    ecrire.mockClear();
    mockChanger.mockResolvedValue(null);
    await act(async () => {
      reponse = await result.current.marquerFait('A2');
    });
    expect(reponse).toBeNull();
    expect(ecrire).not.toHaveBeenCalled();
    expect(result.current.estPartiel(result.current.arrets[0])).toBe(false);
    expect(result.current.terminee).toBe(true);
  });

  it('hors ligne ou démonstration : gardé sur le téléphone, rien n’est écrit en base', async () => {
    mockDemo = true;
    mockResultat = resultat([arret(1), arret(2)]); // arrêts sans id : résultat précalculé
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    expect(result.current.local).toBe(true);
    await act(async () => {
      await result.current.marquerFait('grille:1');
    });
    expect(ecrire).not.toHaveBeenCalled();
    expect(result.current.faits).toBe(1);
    expect(mockRafraichir).not.toHaveBeenCalled();
  });

  it('précédent et suivant déplacent l’arrêt courant sans le marquer', async () => {
    mockDemo = true;
    mockResultat = resultat([arret(1), arret(2), arret(3)]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    expect(result.current.courant?.rang).toBe(1);
    await act(async () => result.current.aller(1));
    expect(result.current.courant?.rang).toBe(2);
    await act(async () => result.current.aller(5));
    expect(result.current.courant?.rang).toBe(3);
    await act(async () => result.current.aller(-9));
    expect(result.current.courant?.rang).toBe(1);
    expect(result.current.faits).toBe(0);
  });

  it('une équipe inconnue donne une tournée vide', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' })]);
    const { result } = await renderHook(() => useSuiviTrajet('inconnue'));
    expect(result.current.tournee).toBeNull();
    expect(result.current.total).toBe(0);
    expect(result.current.terminee).toBe(false);
  });
});
