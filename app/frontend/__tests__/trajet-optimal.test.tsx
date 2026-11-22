import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Endroit, ResultatOptimisation } from '../../src/types';
import TrajetOptimal from '../supervisor/TrajetOptimal';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/ville/carte-tournees', () => ({ CarteTournees: () => null }));

const mockLancer = jest.fn(async (_p?: Record<string, unknown>): Promise<string | null> => null);
const mockEndroits: Endroit[] = [
  {
    cle: 'a',
    position: { latitude: 45.5, longitude: -73.57 },
    nombre: 1,
    gravite_choisie_max: 'elevee',
    gravite_par_nombre: 'elevee',
    gravite_affichee: 'elevee',
    etat_dominant: 'nouveau',
    signalements: [{ id: '1', categorie: 'grille_endommagee', etat: 'nouveau', cree_le: '2026-11-20T10:00:00Z' } as never],
  },
  {
    cle: 'b',
    position: { latitude: 45.51, longitude: -73.57 },
    nombre: 1,
    gravite_choisie_max: 'moyenne',
    gravite_par_nombre: 'moyenne',
    gravite_affichee: 'moyenne',
    etat_dominant: 'nouveau',
    signalements: [{ id: '2', categorie: 'grille_bouchee', etat: 'nouveau', cree_le: '2026-11-20T11:00:00Z' } as never],
  },
];
jest.mock('@/hooks/use-endroits', () => ({ useEndroits: () => ({ endroits: mockEndroits, signalements: [], chargement: false }) }));
jest.mock('@/hooks/use-equipes', () => ({ useEquipes: () => ({ equipes: [], chargement: false }) }));
jest.mock('@/hooks/use-source', () => ({ useSource: () => ({ etat: 'en_ligne' }) }));
jest.mock('@/hooks/use-session-employe', () => ({ useSessionEmploye: () => ({ peutGerer: true }) }));
jest.mock('@/hooks/use-progression-optimisation', () => ({ useProgressionOptimisation: () => ({ etape: 'envoi', fraction: 0.1 }) }));
let mockBascule = false;
let mockEnCours = false;
jest.mock('@/hooks/use-optimisation', () => ({
  useOptimisation: () => ({ lancer: mockLancer, demande: { statut: 'terminee' }, enCours: mockEnCours, basculeSurPrecalcule: mockBascule, message: null }),
}));
const mockArret = (rang: number, cle: string) => ({
  rang,
  cle_endroit: cle,
  signalement_ids: ['s'],
  position: { latitude: 45.5, longitude: -73.57 },
  arrivee_prevue: '2026-11-22T12:00:00Z',
  depart_prevu: '2026-11-22T12:10:00Z',
});
const mockResultat = {
  non_servis: [{ cle_endroit: 'b', gravite: 'moyenne', raison: 'temps du quart dépassé' }],
  tournees: [{ equipe_id: 'e1', equipe_nom: 'Équipe 1', distance_m: 4000, duree_s: 18 * 60, debut_prevu: '', fin_prevue: '', geometrie: null, arrets: [mockArret(1, 'a')] }],
} as unknown as ResultatOptimisation;
jest.mock('@/hooks/use-tournees', () => ({ useTournees: () => ({ resultat: mockResultat, source: 'direct', chargement: false }) }));

describe('trajet optimal', () => {
  it('lance le calcul une fois avec la sélection, puis montre le trajet et ses interventions', async () => {
    await render(<TrajetOptimal cles={['a']} onRetour={jest.fn()} onDetails={jest.fn()} />);
    expect(mockLancer).toHaveBeenCalledTimes(1);
    expect(mockLancer.mock.calls[0][0]).toMatchObject({ cles_endroits: ['a'] });
    expect(screen.getByText('Trajet généré')).toBeTruthy();
    expect(screen.getByText('Itinéraire optimisé pour 1 intervention')).toBeTruthy();
    expect(screen.getByText('18 min')).toBeTruthy();
    expect(screen.getByText('Interventions du trajet (1)')).toBeTruthy();
    expect(screen.getByText("Grille d'égout endommagée")).toBeTruthy();
    expect(screen.getByText('Élevée')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Suivre le trajet de l'équipe Équipe 1"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ville/trajet/[equipe]', params: { equipe: 'e1' } });
  });

  it('liste les endroits non servis avec la raison', async () => {
    mockBascule = false;
    await render(<TrajetOptimal cles={['a', 'b']} onRetour={jest.fn()} onDetails={jest.fn()} />);
    expect(screen.getByText('Endroits non servis (1)')).toBeTruthy();
    expect(screen.getByText('Non servi : temps du quart dépassé')).toBeTruthy();
  });

  it('au-delà de 20 s : annonce le résultat précalculé, dit qu\'il ne porte pas sur la sélection, et le vrai le remplacera', async () => {
    mockBascule = true;
    await render(<TrajetOptimal cles={['a']} onRetour={jest.fn()} onDetails={jest.fn()} />);
    expect(screen.getByText('Le calcul ne répond pas : voici un résultat précalculé.')).toBeTruthy();
    expect(screen.getByText(/Le vrai résultat le remplacera/)).toBeTruthy();
    expect(screen.getByText(/ne porte pas sur votre sélection/)).toBeTruthy();
    mockBascule = false;
  });

  it('pendant un calcul : le plan en place reste affiché tout de suite, avec la barre de progression', async () => {
    mockEnCours = true;
    await render(<TrajetOptimal cles={['a']} onRetour={jest.fn()} onDetails={jest.fn()} />);
    expect(screen.getByText('Calcul des tournées en cours…')).toBeTruthy();
    expect(screen.getByText(/Le plan en place est affiché tout de suite/)).toBeTruthy();
    expect(screen.getByText('Trajet généré')).toBeTruthy();
    expect(screen.getByText('Interventions du trajet (1)')).toBeTruthy();
    mockEnCours = false;
  });

  it('une sélection devenue vide ne part JAMAIS au service : « Aucun endroit à planifier » avec sortie', async () => {
    mockLancer.mockClear();
    const onRetour = jest.fn();
    await render(<TrajetOptimal cles={['zzz-disparu']} onRetour={onRetour} onDetails={jest.fn()} />);
    expect(mockLancer).not.toHaveBeenCalled();
    expect(screen.getByText('Aucun endroit à planifier')).toBeTruthy();
    expect(screen.queryByText('Calcul des tournées en cours…')).toBeNull();
    await fireEvent.press(screen.getByText('Retour à la liste'));
    expect(onRetour).toHaveBeenCalled();
  });

  it('le refus du calcul est toujours visible, même sans plan', async () => {
    mockLancer.mockResolvedValueOnce('Création de la demande refusée : droits insuffisants.');
    await render(<TrajetOptimal cles={['a']} onRetour={jest.fn()} onDetails={jest.fn()} />);
    expect(await screen.findByText('Création de la demande refusée : droits insuffisants.')).toBeTruthy();
  });
});
