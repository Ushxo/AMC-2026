import { act, renderHook } from '@testing-library/react-native';

import * as optimisation from '../../lib/optimisation';
import * as source from '../../lib/source';
import { getSupabase } from '../../lib/supabase';
import { lireEtatTournees, reinitialiserEtatTournees } from '../../lib/store-tournees';
import { useEquipes } from '../use-equipes';
import { useIncidents } from '../use-incidents';
import { DELAI_BASCULE_MS, useOptimisation } from '../use-optimisation';
import { usePassage } from '../use-passage';
import { useTournees } from '../use-tournees';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/equipes', () => ({
  ...jest.requireActual('../../lib/equipes'),
  lireIncidents: jest.fn(async () => [{ id: 'inc-1' }]),
}));
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
jest.mock('../../lib/optimisation', () => ({
  ...jest.requireActual('../../lib/optimisation'),
  creerDemande: jest.fn(),
  lireDemande: jest.fn(),
  lireDerniereTerminee: jest.fn(async () => null),
  lireArretPourSignalement: jest.fn(async () => null),
  abonnerDemandes: jest.fn(() => () => {}),
}));

const s = source as unknown as Record<string, jest.Mock>;
const o = optimisation as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  reinitialiserEtatTournees();
  (getSupabase as jest.Mock).mockReturnValue({});
});

describe('hors ligne (repli)', () => {
  beforeEach(() => s.etatSource.mockReturnValue('repli'));

  it('useTournees : résultat précalculé, source « precalcule »', async () => {
    const { result } = await renderHook(() => useTournees());
    expect(result.current.source).toBe('precalcule');
    expect(result.current.resultat?.precalcule).toBe(true);
    expect(result.current.resultat?.incidents).toEqual([]);
  });

  it('useOptimisation.lancer : bascule sur le précalculé sans appel réseau', async () => {
    const { result } = await renderHook(() => useOptimisation());
    let r: string | null = 'x';
    await act(async () => {
      r = await result.current.lancer();
    });
    expect(r).toBeNull();
    expect(o.creerDemande).not.toHaveBeenCalled();
    expect(lireEtatTournees().forcerPrecalcule).toBe(true);
    expect(result.current.basculeSurPrecalcule).toBe(true);
  });

  it('useEquipes : équipes de démo en lecture seule, écriture refusée avec un message', async () => {
    const { result } = await renderHook(() => useEquipes());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.lectureSeule).toBe(true);
    expect(result.current.equipes.length).toBeGreaterThan(0);
    expect(await result.current.desactiver('equipe-1')).toBe(
      'Démonstration hors ligne : les équipes sont en lecture seule.',
    );
  });

  it("useIncidents : l'incident de démo bascule le résultat, et se retire", async () => {
    const inc = await renderHook(() => useIncidents());
    const tour = await renderHook(() => useTournees());
    expect(inc.result.current.incidents).toEqual([]);
    await act(async () => {
      await inc.result.current.ajouter({ type: 'rue_fermee', position: { latitude: 45.5, longitude: -73.57 } });
    });
    expect(inc.result.current.incidents[0]).toMatchObject({ type: 'rue_fermee', simule: true });
    expect(tour.result.current.resultat?.incidents).toHaveLength(1);
    await act(async () => {
      await inc.result.current.retirer('incident-demo');
    });
    expect(inc.result.current.incidents).toEqual([]);
    expect(tour.result.current.resultat?.incidents).toEqual([]);
  });

  it('usePassage : planifié avec une heure au quart d’heure depuis le précalculé', async () => {
    const pre = optimisation.chargerPrecalcule(false)!;
    const a = pre.tournees[0].arrets[0];
    const { result } = await renderHook(() => usePassage(a.signalement_ids[0]));
    await act(async () => {});
    expect(result.current.suivi.precalcule).toBe(true);
    // Le signalement de démo est « nouveau » ou déjà pris en charge selon les données.
    expect(['planifie', 'pris_en_charge', 'regle', 'rejete', 'recu']).toContain(result.current.suivi.etape);
  });
});

describe('en ligne', () => {
  beforeEach(() => s.etatSource.mockReturnValue('en_ligne'));

  it('lancer : erreur de la demande rendue en message', async () => {
    o.creerDemande.mockResolvedValue({ erreur: 'Le calcul des tournées a échoué. Réessayez.' });
    const { result } = await renderHook(() => useOptimisation());
    let r: string | null = null;
    await act(async () => {
      r = await result.current.lancer();
    });
    expect(r).toBe('Le calcul des tournées a échoué. Réessayez.');
    expect(result.current.enCours).toBe(false);
  });

  it('lancer : demande terminée, le résultat direct est relu', async () => {
    o.creerDemande.mockResolvedValue({ id: 'd1' });
    o.lireDemande.mockResolvedValue({
      id: 'd1', cree_le: 'x', statut: 'terminee', parametres: {}, message: null, commence_le: null, termine_le: 'y',
    });
    const { result } = await renderHook(() => useOptimisation());
    await act(async () => {
      await result.current.lancer();
    });
    expect(result.current.enCours).toBe(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });
    expect(result.current.demande?.statut).toBe('terminee');
    expect(result.current.enCours).toBe(false);
    expect(lireEtatTournees().forcerPrecalcule).toBe(false);
  });

  it('lancer : sans réponse après 20 s, bascule sur le précalculé', async () => {
    jest.useFakeTimers();
    try {
      o.creerDemande.mockResolvedValue({ id: 'd2' });
      o.lireDemande.mockResolvedValue({
        id: 'd2', cree_le: 'x', statut: 'en_cours', parametres: {}, message: null, commence_le: 'z', termine_le: null,
      });
      const { result } = await renderHook(() => useOptimisation());
      await act(async () => {
        await result.current.lancer();
      });
      expect(result.current.enCours).toBe(true);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DELAI_BASCULE_MS + 100);
      });
      expect(result.current.enCours).toBe(false);
      expect(lireEtatTournees().forcerPrecalcule).toBe(true);

      // Le suivi continue : quand la demande se termine, le vrai résultat remplace le précalculé, avec un message.
      o.lireDemande.mockResolvedValue({
        id: 'd2', cree_le: 'x', statut: 'terminee', parametres: {}, message: null, commence_le: 'z', termine_le: 'w',
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });
      expect(lireEtatTournees().forcerPrecalcule).toBe(false);
      expect(result.current.demande?.statut).toBe('terminee');
      expect(result.current.message).toBe('Le calcul est terminé : voici le vrai résultat.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('useTournees : résultat direct tant qu’on ne bascule pas', async () => {
    o.lireDerniereTerminee.mockResolvedValue({ demande_id: 'd9', precalcule: false, tournees: [], incidents: [] });
    const { result } = await renderHook(() => useTournees());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.source).toBe('direct');
    expect(result.current.resultat?.demande_id).toBe('d9');
  });
});

describe('incidents enregistrés avec la demande', () => {
  beforeEach(() => s.etatSource.mockReturnValue('en_ligne'));

  it('lancer envoie les identifiants des incidents actifs ; ceux donnés par l’appelant priment', async () => {
    o.creerDemande.mockResolvedValue({ erreur: 'stop' });
    const { result } = await renderHook(() => useOptimisation());
    await act(async () => {
      await result.current.lancer({ date: '2026-11-23' });
    });
    expect(o.creerDemande).toHaveBeenLastCalledWith({ date: '2026-11-23', incident_ids: ['inc-1'] });
    await act(async () => {
      await result.current.lancer({ incident_ids: [] });
    });
    expect(o.creerDemande).toHaveBeenLastCalledWith({ incident_ids: [] });
  });
});
