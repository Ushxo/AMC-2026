import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FeuilleProfil } from '../../src/components/profil/feuille-profil';
import { lireMarque, reinitialiserMarque } from '../../src/marque/magasin';
import { organisationEmbarquee } from '../../src/marque/organisations-embarquees';
import MarqueOrganisation from '../admin/MarqueOrganisation';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockEnregistrer = jest.fn();
const mockCreer = jest.fn();
const mockComptes = jest.fn();
jest.mock('@/lib/comptes-admin', () => ({ listerComptes: () => mockComptes() }));
jest.mock('@/lib/organisations', () => {
  const actual = jest.requireActual('@/lib/organisations');
  return {
    ...actual,
    lireOrganisations: async () => ({ organisations: actual.ORGANISATIONS_EMBARQUEES.map((o: object, i: number) => ({ ...o, id: `o${i}` })), enBase: true }),
    enregistrerOrganisation: (...a: unknown[]) => mockEnregistrer(...a),
    creerOrganisation: (...a: unknown[]) => mockCreer(...a),
  };
});

beforeEach(() => {
  reinitialiserMarque();
  mockEnregistrer.mockReset().mockResolvedValue(null);
  mockCreer.mockReset().mockResolvedValue(null);
  mockComptes.mockReset().mockResolvedValue(null);
});

describe('feuille du profil : thème', () => {
  it('le citoyen ne peut pas changer de ville ni de marque', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} onConnexionPersonnel={jest.fn()} />);
    expect(screen.queryByText('Changer de ville')).toBeNull();
    expect(screen.queryByText('Marque de démonstration')).toBeNull();
    expect(screen.queryByLabelText(/Ville de Montréal : /)).toBeNull();
    expect(lireMarque().organisation.code).toBe('priorix');
    expect(screen.queryByText('Tournées optimisées par Priorix')).toBeNull();
  });

  it('thème : six cartes avec aperçu, thème de l’organisation en premier, application immédiate', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} />);
    const radios = screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel);
    expect(radios).toEqual(["Thème de l'organisation", 'Océan', 'Ardoise', 'Terre cuite', 'Prune', 'Nuit']);
    await fireEvent.press(screen.getByLabelText('Nuit'));
    expect(lireMarque().theme).toBe('nuit');
    expect(lireMarque().jetons.background).toBe('#0F141C');
    await fireEvent.press(screen.getByLabelText('Océan'));
    expect(lireMarque().jetons.primary).toBe('#0B4F7C');
    await fireEvent.press(screen.getByLabelText("Thème de l'organisation"));
    expect(lireMarque().theme).toBe('organisation');
    expect(lireMarque().organisation.code).toBe('priorix'); // le thème ne change jamais l'organisation
  });

  it('lisibilité : deux interrupteurs séparés, par-dessus le thème choisi', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Prune'));
    await fireEvent(screen.getByLabelText('Contraste élevé : désactivé'), 'valueChange', true);
    expect(lireMarque().theme).toBe('prune');
    expect(lireMarque().lisibilite).toEqual({ contraste: true, daltonisme: false });
    expect(lireMarque().jetons.background).toBe('#FFFFFF');
    await fireEvent(screen.getByLabelText('Adapté au daltonisme : désactivé'), 'valueChange', true);
    expect(lireMarque().lisibilite).toEqual({ contraste: true, daltonisme: true });
  });

  it('un compte du personnel ne change pas de ville ; il voit « Tournées optimisées par Priorix »', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} nom="Léa" role="Superviseur" onDeconnexion={jest.fn()} />);
    expect(screen.queryByText('Changer de ville')).toBeNull();
    expect(screen.getByText('Thème')).toBeTruthy();
    expect(screen.getByText('Tournées optimisées par Priorix')).toBeTruthy();
    expect(screen.getByText('Se déconnecter')).toBeTruthy();
  });

  it('la démonstration hors ligne du personnel peut essayer une marque, annoncée simulée', async () => {
    await render(<FeuilleProfil visible onFermer={jest.fn()} nom="Léa" role="Superviseur" marqueChoisie="demo" />);
    expect(screen.getByText(/Simulé pour la démonstration hors ligne/)).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText(/Ville de Montréal : Ville de Montréal/));
    expect(lireMarque().organisation.code).toBe('montreal');
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
    await fireEvent.press(screen.getByText("Enregistrer l'organisation"));
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
    await fireEvent.press(screen.getByText("Enregistrer l'organisation"));
    expect(await screen.findByText(/2 caractères au moins/)).toBeTruthy();
    expect(mockEnregistrer).not.toHaveBeenCalled();
  });

  it('refus du serveur : message affiché, marque inchangée', async () => {
    mockEnregistrer.mockResolvedValue('Seul un administrateur peut faire ce changement.');
    await render(<MarqueOrganisation />);
    await screen.findByLabelText('Aperçu de la marque Priorix');
    await fireEvent.press(screen.getByLabelText('Préréglage Rouge Montréal'));
    await fireEvent.press(screen.getByText("Enregistrer l'organisation"));
    expect(await screen.findByText(/Seul un administrateur/)).toBeTruthy();
    expect(lireMarque().jetons.primary).toBe(organisationEmbarquee('priorix')!.couleurs.primary);
  });
});

describe('administration : créer une organisation', () => {
  it('nom, service en un toucher, création : aucune organisation fictive n’existe d’avance', async () => {
    await render(<MarqueOrganisation />);
    expect(await screen.findByLabelText('Créer une organisation')).toBeTruthy();
    expect(screen.queryByLabelText(/^Déneigement/)).toBeNull(); // la liste ne contient que les organisations réelles ; « Déneigement » n'est qu'un exemple de service
    await fireEvent.press(screen.getByLabelText('Créer une organisation'));
    await fireEvent.changeText(screen.getByLabelText("Nom de l'organisation"), 'Déneigement Nord');
    expect(screen.getByText(/Code de l'organisation : deneigement-nord/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Service : Déneigement'));
    await fireEvent.press(screen.getByText("Créer l'organisation"));
    await waitFor(() => expect(mockCreer).toHaveBeenCalled());
    expect(mockCreer.mock.calls[0][0]).toMatchObject({ code: 'deneigement-nord', nom: 'Déneigement Nord', nom_app: 'Déneigement Nord', service: 'Déneigement' });
  });

  it('un refus du serveur est affiché tel quel', async () => {
    mockCreer.mockResolvedValue('Seul un administrateur peut créer une organisation.');
    await render(<MarqueOrganisation />);
    await fireEvent.press(await screen.findByLabelText('Créer une organisation'));
    await fireEvent.changeText(screen.getByLabelText("Nom de l'organisation"), 'Collecte Sud');
    await fireEvent.press(screen.getByText("Créer l'organisation"));
    expect(await screen.findByText('Seul un administrateur peut créer une organisation.')).toBeTruthy();
  });
});

describe('administration : nombre de comptes par organisation', () => {
  it('affiché quand la liste complète répond, absent sinon', async () => {
    mockComptes.mockResolvedValue({ complete: true, comptes: [{ organisation: 'Ville de Montréal' }, { organisation: 'Ville de Montréal' }, { organisation: 'Priorix' }] });
    await render(<MarqueOrganisation />);
    expect(await screen.findByText(/2 comptes/)).toBeTruthy();
    expect(screen.getByText(/1 compte$/)).toBeTruthy();
  });
  it('sans la liste complète, aucun nombre inventé', async () => {
    await render(<MarqueOrganisation />);
    await screen.findByLabelText('Créer une organisation');
    expect(screen.queryByText(/compte/)).toBeNull();
  });
});

describe('administration : thème par défaut de l’organisation', () => {
  it('un thème de l’app donne sa palette complète aux couleurs de l’organisation', async () => {
    await render(<MarqueOrganisation />);
    await fireEvent.press(await screen.findByLabelText("Thème Prune comme couleurs de l'organisation"));
    await fireEvent.press(screen.getByText("Enregistrer l'organisation"));
    await waitFor(() => expect(mockEnregistrer).toHaveBeenCalled());
    expect(mockEnregistrer.mock.calls[0][0].couleurs).toMatchObject({ primary: '#5B2A86', accent: '#D0348A', background: '#F8F3FB' });
  });
});
