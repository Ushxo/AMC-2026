import { render, screen } from '@testing-library/react-native';

import type { Arret, ResultatOptimisation, Tournee } from '../../src/types';
import ArretsFaits from '../supervisor/ArretsFaits';
import TableauDeBord from '../supervisor/TableauDeBord';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockTournees = jest.fn();
const mockResume = jest.fn();
jest.mock('@/hooks/use-endroits', () => ({
  useEndroits: () => ({
    endroits: [
      { cle: 'a', position: { latitude: 45.5, longitude: -73.57 }, nombre: 1, gravite_choisie_max: 'elevee', gravite_par_nombre: 'elevee', gravite_affichee: 'elevee', etat_dominant: 'nouveau', signalements: [{ id: '1', etat: 'nouveau', categorie: 'grille_bouchee', cree_le: '2026-11-20T10:00:00Z' }] },
      { cle: 'b', position: { latitude: 45.51, longitude: -73.57 }, nombre: 1, gravite_choisie_max: 'faible', gravite_par_nombre: 'faible', gravite_affichee: 'faible', etat_dominant: 'nouveau', signalements: [{ id: '2', etat: 'nouveau', categorie: 'eau_accumulee', cree_le: '2026-11-20T11:00:00Z' }] },
    ],
    chargement: false,
  }),
}));
jest.mock('@/hooks/use-tournees', () => ({ useTournees: () => mockTournees() }));
jest.mock('@/hooks/use-resume-ville', () => ({ useResumeVille: () => mockResume() }));

const arret = (rang: number, fait: boolean): Arret => ({
  rang,
  cle_endroit: `c${rang}`,
  signalement_ids: ['s'],
  position: { latitude: 45.5, longitude: -73.57 },
  arrivee_prevue: '2026-11-22T12:00:00Z',
  depart_prevu: '2026-11-22T12:10:00Z',
  fait,
  ...(fait ? { fait_le: '2026-11-22T12:05:00Z' } : {}),
});
const tournee = (nom: string, arrets: Arret[]): Tournee => ({
  equipe_id: nom,
  equipe_nom: nom,
  distance_m: 5000,
  duree_s: 3600,
  debut_prevu: '2026-11-22T12:00:00Z',
  fin_prevue: '2026-11-22T13:00:00Z',
  geometrie: null,
  arrets,
});
const resultat = (tournees: Tournee[]) => ({ tournees }) as unknown as ResultatOptimisation;

describe('rapports du superviseur : arrêts faits (lecture)', () => {
  it('chargement, aucune tournée, aucun arrêt fait', async () => {
    mockTournees.mockReturnValue({ resultat: null, chargement: true });
    const { rerender } = await render(<ArretsFaits />);
    expect(screen.getByText('Chargement des tournées…')).toBeTruthy();
    mockTournees.mockReturnValue({ resultat: resultat([]), chargement: false });
    await rerender(<ArretsFaits />);
    expect(screen.getByText('Aucune tournée pour le moment.')).toBeTruthy();
    mockTournees.mockReturnValue({ resultat: resultat([tournee('Équipe 1', [arret(1, false)])]), chargement: false });
    await rerender(<ArretsFaits />);
    expect(screen.getByText('Aucun arrêt fait pour l’instant.')).toBeTruthy();
  });

  it('liste les arrêts faits de chaque équipe', async () => {
    mockTournees.mockReturnValue({ resultat: resultat([tournee('Équipe 1', [arret(1, true), arret(2, false), arret(3, true)])]), chargement: false });
    await render(<ArretsFaits />);
    expect(screen.getByText('Équipe 1')).toBeTruthy();
    expect(screen.getByText('2 sur 3')).toBeTruthy();
    expect(screen.getByLabelText(/^Arrêt 1, .*, \d+ h \d+$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Arrêt 3, /)).toBeTruthy();
    // le prochain arrêt à venir (le 2) suit les arrêts faits
    expect(screen.getByLabelText(/^Arrêt 2, .*À venir$/)).toBeTruthy();
  });

  it('montre les arrêts pas réglés avec le commentaire de l’équipe', async () => {
    const nonRegle: Arret = { ...arret(2, false), regle: false, commentaire: 'Grille à remplacer', evalue_le: '2026-11-22T14:00:00Z' };
    mockTournees.mockReturnValue({ resultat: resultat([tournee('Équipe 1', [arret(1, true), nonRegle, arret(3, false)])]), chargement: false });
    await render(<ArretsFaits />);
    expect(screen.getByText('2 sur 3')).toBeTruthy();
    expect(screen.getByLabelText(/^Arrêt 2, .*Pas réglé, Grille à remplacer$/)).toBeTruthy();
    expect(screen.getByText('« Grille à remplacer »')).toBeTruthy();
    expect(screen.getByLabelText(/^Arrêt 3, .*À venir$/)).toBeTruthy();
  });

  it('montre quand le rapport de l’équipe a été reçu', async () => {
    const t = { ...tournee('Équipe 1', [arret(1, true)]), rapport_envoye_le: '2026-11-22T15:00:00Z' };
    mockTournees.mockReturnValue({ resultat: resultat([t]), chargement: false });
    await render(<ArretsFaits />);
    expect(screen.getByText(/^Rapport reçu le /)).toBeTruthy();
  });
});

describe('tableau de bord du superviseur', () => {
  it('chiffres à traiter et réglés, et le plan des équipes', async () => {
    mockResume.mockReturnValue({
      resume: { parEtat: { nouveau: 5, pris_en_charge: 2, regle: 3, rejete: 0 }, parCategorie: { grille_bouchee: 4, eau_accumulee: 4, eau_douteuse: 1, absence_eau: 1, autre: 0 } },
      chargement: false,
      erreur: null,
    });
    mockTournees.mockReturnValue({ resultat: resultat([tournee('Équipe 1', [arret(1, false)])]), chargement: false });
    await render(<TableauDeBord />);
    expect(screen.getByLabelText('2 endroits à traiter')).toBeTruthy();
    expect(screen.getByLabelText('3 signalements réglés')).toBeTruthy();
    expect(screen.getByText('Plan des équipes')).toBeTruthy();
    expect(screen.getByLabelText(/Équipe 1 : 1 arrêt, 1 h 00, 0 faits/)).toBeTruthy();
    expect(screen.getByLabelText('Élevée : 1')).toBeTruthy();
    expect(screen.getByLabelText('Faible : 1')).toBeTruthy();
  });

  it('sans plan : invite à lancer l’optimisation ; erreur de lecture : message', async () => {
    const resume = { parEtat: { nouveau: 0, pris_en_charge: 0, regle: 0, rejete: 0 }, parCategorie: { grille_bouchee: 0, eau_accumulee: 0, eau_douteuse: 0, absence_eau: 0, autre: 0 } };
    mockResume.mockReturnValue({ resume, chargement: false, erreur: null });
    mockTournees.mockReturnValue({ resultat: null, chargement: false });
    const { rerender } = await render(<TableauDeBord />);
    expect(screen.getByText(/Aucun plan pour le moment/)).toBeTruthy();
    mockResume.mockReturnValue({ resume, chargement: false, erreur: 'Les signalements ne peuvent pas être lus.' });
    await rerender(<TableauDeBord />);
    expect(screen.getByText('Les signalements ne peuvent pas être lus.')).toBeTruthy();
  });
});
