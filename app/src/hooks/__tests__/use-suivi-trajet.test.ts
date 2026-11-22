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
jest.mock('../../lib/trajet', () => ({ ...jest.requireActual('../../lib/trajet'), ecrireArretFait: jest.fn(), ecrireResultatArret: jest.fn() }));

const ecrire = trajet.ecrireArretFait as jest.Mock;
const ecrireResultat = trajet.ecrireResultatArret as jest.Mock;

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
  ecrireResultat.mockReset().mockResolvedValue('ok');
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

describe('useSuiviTrajet : résultat d’un arrêt (Oui ou Non)', () => {
  it('Oui avec commentaire : écrit fait et le mot, règle les signalements ouverts', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' }), arret(2, { id: 'A2' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    let r = { erreur: 'x' as string | null, info: null as string | null };
    await act(async () => {
      r = await result.current.enregistrerResultat('A1', { fait: true, commentaire: ' Grille un peu cassée ' });
    });
    expect(r.erreur).toBeNull();
    expect(ecrireResultat).toHaveBeenCalledWith('A1', { fait: true, commentaire: 'Grille un peu cassée' });
    expect(mockChanger).toHaveBeenCalledWith('s1a', 'regle');
    expect(result.current.faits).toBe(1);
    expect(result.current.commentaire(result.current.arrets[0])).toBe('Grille un peu cassée');
  });

  it('Non avec commentaire : traité, signalements LAISSÉS ouverts, on passe au suivant', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' }), arret(2, { id: 'A2' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    await act(async () => {
      await result.current.enregistrerResultat('A1', { fait: false, commentaire: 'Grille brisée, à réparer' });
    });
    expect(ecrireResultat).toHaveBeenCalledWith('A1', { fait: false, commentaire: 'Grille brisée, à réparer' });
    expect(mockChanger).not.toHaveBeenCalled();
    expect(result.current.estNonFait(result.current.arrets[0])).toBe(true);
    expect(result.current.estFait(result.current.arrets[0])).toBe(false);
    expect(result.current.traites).toBe(1);
    expect(result.current.nonFaits).toBe(1);
    expect(result.current.faits).toBe(0);
    expect(result.current.prochain?.rang).toBe(2);
  });

  it('Non sans commentaire : refusé, rien n’est écrit', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    let r = { erreur: null as string | null, info: null as string | null };
    await act(async () => {
      r = await result.current.enregistrerResultat('A1', { fait: false, commentaire: '   ' });
    });
    expect(r.erreur).toMatch(/pourquoi/);
    expect(ecrireResultat).not.toHaveBeenCalled();
    expect(result.current.traites).toBe(0);
  });

  it('migration 0012 absente : Non dit qu’il faut une mise à jour, sans rien noter ; Oui passe sans commentaire', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' }), arret(2, { id: 'A2' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    ecrireResultat.mockResolvedValueOnce('migration');
    let r = { erreur: null as string | null, info: null as string | null };
    await act(async () => {
      r = await result.current.enregistrerResultat('A1', { fait: false, commentaire: 'Accès impossible' });
    });
    expect(r.erreur).toBe('Cette fonction demande une mise à jour de la base.');
    expect(result.current.traites).toBe(0);
    ecrireResultat.mockResolvedValueOnce('ok_sans_commentaire');
    await act(async () => {
      r = await result.current.enregistrerResultat('A2', { fait: true, commentaire: 'Un mot' });
    });
    expect(r.erreur).toBeNull();
    expect(r.info).toMatch(/commentaire n'a pas pu être gardé/);
    expect(result.current.faits).toBe(1);
  });

  it('correction du choix : Oui vers Non rouvre les signalements, Non vers Oui les règle', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' })]);
    mockSignalements = [{ id: 's1a', etat: 'nouveau' }, { id: 's1b', etat: 'nouveau' }];
    const { result, rerender } = await renderHook(() => useSuiviTrajet('e1'));
    await act(async () => {
      await result.current.enregistrerResultat('A1', { fait: true, commentaire: '' });
    });
    expect(mockChanger).toHaveBeenCalledTimes(2);
    mockChanger.mockClear();
    mockSignalements = [{ id: 's1a', etat: 'regle' }, { id: 's1b', etat: 'regle' }];
    await rerender({});
    await act(async () => {
      await result.current.enregistrerResultat('A1', { fait: false, commentaire: 'Finalement brisée' });
    });
    expect(result.current.estNonFait(result.current.arrets[0])).toBe(true);
    expect(mockChanger).toHaveBeenCalledWith('s1a', 'pris_en_charge');
    expect(mockChanger).toHaveBeenCalledWith('s1b', 'pris_en_charge');
    mockChanger.mockClear();
    mockSignalements = [{ id: 's1a', etat: 'pris_en_charge' }, { id: 's1b', etat: 'pris_en_charge' }];
    await rerender({});
    await act(async () => {
      await result.current.enregistrerResultat('A1', { fait: true, commentaire: '' });
    });
    expect(result.current.estFait(result.current.arrets[0])).toBe(true);
    expect(result.current.estNonFait(result.current.arrets[0])).toBe(false);
    expect(mockChanger).toHaveBeenCalledWith('s1a', 'regle');
  });

  it('un arrêt non fait compte comme traité : la tournée peut se terminer', async () => {
    mockResultat = resultat([arret(1, { id: 'A1' }), arret(2, { id: 'A2', non_fait: true, commentaire: 'Accès impossible', traite_le: '2026-11-22T12:30:00Z' })]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    expect(result.current.estNonFait(result.current.arrets[1])).toBe(true);
    expect(result.current.terminee).toBe(false);
    await act(async () => {
      await result.current.enregistrerResultat('A1', { fait: true, commentaire: '' });
    });
    expect(result.current.terminee).toBe(true);
    expect(result.current.traites).toBe(2);
    expect(result.current.nonFaits).toBe(1);
  });

  it('hors ligne : le résultat reste sur le téléphone, rien n’est écrit en base', async () => {
    mockDemo = true;
    mockResultat = resultat([arret(1), arret(2)]);
    const { result } = await renderHook(() => useSuiviTrajet('e1'));
    await act(async () => {
      await result.current.enregistrerResultat('grille:1', { fait: false, commentaire: 'Matériel manquant' });
    });
    expect(ecrireResultat).not.toHaveBeenCalled();
    expect(result.current.nonFaits).toBe(1);
    expect(result.current.commentaire(result.current.arrets[0])).toBe('Matériel manquant');
  });
});
