import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FeuilleProfil } from '../../src/components/profil/feuille-profil';
import { lireMarque, reinitialiserMarque } from '../../src/marque/magasin';
import { organisationEmbarquee } from '../../src/marque/organisations-embarquees';
import MarqueOrganisation from '../admin/MarqueOrganisation';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockEnregistrer = jest.fn();
jest.mock('@/lib/organisations', () => {
  const actual = jest.requireActual('@/lib/organisations');
  return {
    ...actual,
    lireOrganisations: async () => ({ organisations: actual.ORGANISATIONS_EMBARQUEES.map((o: object, i: number) => ({ ...o, id: `o${i}` })), enBase: true }),
    enregistrerOrganisation: (...a: unknown[]) => mockEnregistrer(...a),
  };
});

beforeEach(() => {
  reinitialiserMarque();
  mockEnregistrer.mockReset().mockResolvedValue(null);
});

describe('feuille du profil : apparence et changement de ville', () => {
  it('le citoyen change de ville : toute la marque change en direct', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} marqueChoisie="citoyen" onConnexionPersonnel={jest.fn()} />);
    expect(lireMarque().organisation.code).toBe('priorix');
    await fireEvent.press(await screen.findByLabelText(/Ville de Montréal : Égouts Montréal/));
    expect(lireMarque().organisation.code).toBe('montreal');
    expect(lireMarque().jetons.primary).toBe('#B5121B');
    expect(screen.getByText('Votre choix est gardé sur ce téléphone.')).toBeTruthy();
  });

  it('apparence : trois variantes appliquées à la marque courante', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} marqueChoisie="citoyen" />);
    await fireEvent.press(screen.getByText('Sombre'));
    expect(lireMarque().apparence).toBe('sombre');
    await fireEvent.press(screen.getByText('Contraste élevé'));
    expect(lireMarque().jetons.background).toBe('#FFFFFF');
    await fireEvent.press(screen.getByText('Standard'));
    expect(lireMarque().apparence).toBe('standard');
  });

  it('un compte du personnel ne change pas de ville (sa marque vient de son organisation)', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} nom="Léa" role="Superviseur" onDeconnexion={jest.fn()} />);
    expect(screen.queryByText('Changer de ville')).toBeNull();
    expect(screen.getByText('Apparence')).toBeTruthy();
    expect(screen.getByText('Se déconnecter')).toBeTruthy();
  });
});

describe('administration : marque de l’organisation', () => {
  it('un préréglage change l’aperçu, le contraste reste lisible, l’enregistrement applique la marque en direct', async () => {
    await render(<MarqueOrganisation />);
    expect(await screen.findByLabelText('Aperçu de la marque Priorix')).toBeTruthy();
    expect(screen.getByText(/sont recalculées à partir de ces quatre couleurs/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Préréglage Bleu fleuve'));
    expect(screen.getAllByText(/^Lisible :/).length).toBeGreaterThanOrEqual(5); // tous les couples sont lisibles
    expect(screen.queryByText(/^Illisible :/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Nom de l'app"), 'Priorix Bleu');
    await fireEvent.press(screen.getByText('Enregistrer la marque'));
    await waitFor(() => expect(screen.getByText(/Marque enregistrée/)).toBeTruthy());
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ nom_app: 'Priorix Bleu', couleurs: expect.objectContaining({ primary: '#0F4C81' }) }));
    expect(lireMarque().organisation.nom_app).toBe('Priorix Bleu');
    expect(lireMarque().jetons.primary).toBe('#0F4C81');
  });

  it('un code couleur saisi à la main est pris ; une saisie incomplète est ignorée ; un nom trop court est refusé', async () => {
    await render(<MarqueOrganisation />);
    await screen.findByLabelText('Aperçu de la marque Priorix');
    await fireEvent.changeText(screen.getByLabelText('Boutons d\'action, code couleur'), '#FFE066'); // clair : le texte passe en noir
    await fireEvent.changeText(screen.getByLabelText('Couleur principale, code couleur'), '#12');
    expect(screen.queryByText(/^Illisible :/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Nom de l'app"), 'P');
    await fireEvent.press(screen.getByText('Enregistrer la marque'));
    expect(await screen.findByText(/2 caractères au moins/)).toBeTruthy();
    expect(mockEnregistrer).not.toHaveBeenCalled();
  });

  it('refus du serveur : message affiché, marque inchangée', async () => {
    mockEnregistrer.mockResolvedValue('Seul un administrateur peut faire ce changement.');
    await render(<MarqueOrganisation />);
    await screen.findByLabelText('Aperçu de la marque Priorix');
    await fireEvent.press(screen.getByLabelText('Préréglage Rouge Montréal'));
    await fireEvent.press(screen.getByText('Enregistrer la marque'));
    expect(await screen.findByText(/Seul un administrateur/)).toBeTruthy();
    expect(lireMarque().jetons.primary).toBe(organisationEmbarquee('priorix')!.couleurs.primary);
  });
});
