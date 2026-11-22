import { fireEvent, render, screen } from '@testing-library/react-native';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, textesIllisibles } from '../aide-tests/lisibilite';
import { reinitialiserMarque } from '../../src/marque/magasin';

import FicheEquipe from '../../src/app/ville/equipe/[id]';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: jest.requireActual('react-native').View,
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'e1' }),
}));
jest.mock('@/components/ville/choix-adresse', () => ({ ChoixAdresse: () => null }));
jest.mock('@/hooks/use-positions-equipes', () => ({ usePositionsEquipes: () => ({ positions: [{ equipe_id: 'e1', maj_le: new Date().toISOString() }] }) }));
jest.mock('@/hooks/use-session-employe', () => ({ useSessionEmploye: () => ({ peutGerer: true }) }));
jest.mock('@/hooks/use-source', () => ({ useSource: () => ({ etat: 'en_ligne' }) }));
jest.mock('@/hooks/use-equipes', () => ({
  useEquipes: () => ({
    equipes: [{ id: 'e1', nom: 'Équipe Nord', active: true, garage: { latitude: 45.5, longitude: -73.57 }, garage_adresse: '800 rue X', debut_quart: '07:00', fin_quart: '14:00', vehicule: null, compte_id: 'c1', membres: [] }],
    modifier: jest.fn(),
    desactiver: jest.fn(),
    lectureSeule: false,
    chargement: false,
    erreur: null,
    rafraichir: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-tournees', () => ({
  useTournees: () => ({
    resultat: {
      tournees: [
        {
          equipe_id: 'e1',
          equipe_nom: 'Équipe Nord',
          distance_m: 5000,
          duree_s: 3600,
          debut_prevu: '2026-11-22T12:00:00Z',
          fin_prevue: '2026-11-22T13:00:00Z',
          geometrie: null,
          arrets: [
            { rang: 1, cle_endroit: 'a', signalement_ids: ['s'], position: { latitude: 45.5, longitude: -73.57 }, arrivee_prevue: '2026-11-22T12:10:00Z', depart_prevu: '2026-11-22T12:20:00Z', fait: true },
            { rang: 2, cle_endroit: 'b', signalement_ids: ['s2'], position: { latitude: 45.51, longitude: -73.57 }, arrivee_prevue: '2026-11-22T12:30:00Z', depart_prevu: '2026-11-22T12:40:00Z' },
          ],
        },
      ],
    },
  }),
}));

describe('fiche d’équipe', () => {
  it('départ, arrivée, compte, trajet du jour, et « Suivre ce trajet »', async () => {
    await render(<FicheEquipe />);
    expect(screen.getAllByText('Équipe Nord').length).toBeGreaterThan(0);
    expect(screen.getByText('800 rue X')).toBeTruthy();
    expect(screen.getByText('Retour au garage')).toBeTruthy();
    expect(screen.getByText('Compte associé')).toBeTruthy();
    expect(screen.getByText('Trajet du jour')).toBeTruthy();
    expect(screen.getByText(/2 arrêts, dont 1 faits/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Suivre ce trajet'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ville/trajet/[equipe]', params: { equipe: 'e1' } });
  });
});

describe('lisibilité sous chaque thème (fiche-equipe)', () => {
  beforeEach(() => reinitialiserMarque());
  it.each(COMBINAISONS_THEMES)('thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<FicheEquipe />);
    expect(textesIllisibles()).toEqual([]);
  });
});
