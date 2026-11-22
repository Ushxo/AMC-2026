import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Endroit, Signalement } from '../../src/types';
import SupervisorApp from '../supervisor/SupervisorApp';
import InterventionsAPlanifier from '../supervisor/InterventionsAPlanifier';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, fondDeLaRacine, textesIllisibles } from '../aide-tests/lisibilite';
import { lireMarque, reinitialiserMarque } from '../../src/marque/magasin';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const sig = (id: string, etat: Signalement['etat'], categorie: Signalement['categorie'], cree_le: string): Signalement =>
  ({ id, etat, categorie, cree_le, latitude: 45.5, longitude: -73.57, gravite: 'moyenne', exemple_demo: false }) as unknown as Signalement;
const endroit = (cle: string, gravite: Endroit['gravite_affichee'], etat: Endroit['etat_dominant'], signalements: Signalement[]): Endroit => ({
  cle,
  position: { latitude: 45.5, longitude: -73.57 },
  nombre: signalements.filter((s) => s.etat === 'nouveau' || s.etat === 'pris_en_charge').length,
  gravite_choisie_max: gravite,
  gravite_par_nombre: gravite,
  gravite_affichee: gravite,
  etat_dominant: etat,
  signalements,
});
const mockDonnees: { endroits: Endroit[]; chargement: boolean; erreur: string | null; rafraichir: jest.Mock } = {
  endroits: [
    endroit('a', 'elevee', 'nouveau', [sig('1', 'nouveau', 'grille_bouchee', '2026-11-20T10:00:00Z')]),
    endroit('b', 'moyenne', 'pris_en_charge', [sig('2', 'pris_en_charge', 'eau_accumulee', '2026-11-20T11:00:00Z'), sig('3', 'nouveau', 'eau_accumulee', '2026-11-20T12:00:00Z')]),
    endroit('c', 'faible', 'regle', [sig('4', 'regle', 'affaissement', '2026-11-19T10:00:00Z')]),
    endroit('d', 'faible', 'rejete', [sig('5', 'rejete', 'grille_endommagee', '2026-11-18T10:00:00Z')]),
  ],
  chargement: false,
  erreur: null,
  rafraichir: jest.fn(async () => {}),
};
jest.mock('@/hooks/use-endroits', () => ({ useEndroits: () => ({ ...mockDonnees, signalements: [] }) }));
jest.mock('@/app/ville/equipes', () => ({ EcranEquipes: () => null }));
jest.mock('@/app/ville/tournees', () => ({ EcranTournees: () => null }));
jest.mock('../supervisor/TrajetOptimal', () => ({ __esModule: true, default: () => null }));
jest.mock('../supervisor/ArretsFaits', () => ({ __esModule: true, default: () => null }));
jest.mock('../supervisor/TableauDeBord', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => ({ nom: 'Léa', demoHorsLigne: false }) }));
jest.mock('@/hooks/use-zones-signalements', () => ({ useZonesSignalements: () => [] }));

beforeEach(() => {
  reinitialiserMarque();
  mockPush.mockClear();
  mockDonnees.chargement = false;
  mockDonnees.erreur = null;
  mockDonnees.rafraichir.mockClear();
});

const a = (libelle: string) => screen.getAllByLabelText(libelle).length > 0; // le compteur est lu à deux niveaux (cadre et chiffre)

async function choisirEtat(libelle: string) {
  await fireEvent.press(screen.getByLabelText(/^État : /));
  await fireEvent.press(screen.getByRole('radio', { name: libelle }));
}

const rendre = () => render(<InterventionsAPlanifier onCalculer={jest.fn()} onTableau={jest.fn()} />);

describe('superviseur : un seul écran pour planifier et suivre les endroits signalés', () => {
  it('par défaut : « À planifier », compteur « 2 à traiter », filtre État à « À traiter »', async () => {
    await rendre();
    expect(screen.getByText('À planifier')).toBeTruthy();
    expect(a('2 à traiter')).toBe(true);
    expect(screen.getByLabelText('État : À traiter. Changer.')).toBeTruthy();
    expect(screen.queryByText('Régle', { exact: false })).toBeNull();
  });

  it('filtre d’état « Réglés » : titre et compteur suivent, la ligne dit « Réglé », le calcul est désactivé avec une phrase', async () => {
    const onCalculer = jest.fn();
    await render(<InterventionsAPlanifier onCalculer={onCalculer} onTableau={jest.fn()} />);
    await choisirEtat('Réglés');
    expect(screen.getByRole('header', { name: 'Réglés' })).toBeTruthy();
    expect(a('1 endroit')).toBe(true);
    expect(screen.getAllByText('Réglé').length).toBeGreaterThan(0);
    expect(screen.getByText(/Le calcul ne porte que sur des endroits à traiter/)).toBeTruthy();
    const bouton = screen.getByLabelText(/^Calculer le trajet optimal/);
    expect(bouton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(bouton);
    expect(onCalculer).not.toHaveBeenCalled();
  });

  it('les autres états : nouveaux, pris en charge, rejetés, tous', async () => {
    await rendre();
    await choisirEtat('Rejetés');
    expect(a('1 endroit')).toBe(true);
    await choisirEtat('Tous');
    expect(a('4 endroits')).toBe(true);
    await choisirEtat('Nouveaux');
    expect(a('2 endroits')).toBe(true); // a et b (un signalement nouveau)
    await choisirEtat('Pris en charge');
    expect(a('1 endroit')).toBe(true);
  });

  it('filtres combinés : état et type de problème ensemble', async () => {
    await rendre();
    await choisirEtat('Tous');
    await fireEvent.press(screen.getByLabelText(/^Type de problème : /));
    await fireEvent.press(screen.getByRole('radio', { name: "Accumulation d'eau ou inondation" }));
    expect(a('1 endroit')).toBe(true);
  });

  it('chaque ligne montre le nombre de signalements et l’état quand il n’est pas « nouveau », et ouvre la fiche d’endroit', async () => {
    await rendre();
    expect(screen.getByText('2 signalements · Pris en charge')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Importance Moyenne, .*2 signalements · Pris en charge\. Ouvrir la fiche\./));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ville/endroit', params: { cle: 'b' } }); // plusieurs signalements : fiche d'endroit
    await fireEvent.press(screen.getByLabelText(/^Importance Élevée, /));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/ville/signalement/[id]', params: { id: '1' } });
  });

  it('le calcul reste actif sur les endroits à traiter et part avec leurs clés ; lien vers le tableau de bord gardé', async () => {
    const onCalculer = jest.fn();
    const onTableau = jest.fn();
    await render(<InterventionsAPlanifier onCalculer={onCalculer} onTableau={onTableau} />);
    await fireEvent.press(screen.getByLabelText(/^Calculer le trajet optimal pour 2/));
    expect(onCalculer).toHaveBeenCalledWith(['a', 'b']);
    await fireEvent.press(screen.getByText('Voir le tableau de bord complet'));
    expect(onTableau).toHaveBeenCalled();
  });

  it('tirer pour actualiser relit les signalements', async () => {
    await rendre();
    const liste = screen.getByTestId('liste-interventions');
    await liste.props.refreshControl.props.onRefresh();
    expect(mockDonnees.rafraichir).toHaveBeenCalledTimes(1);
  });

  it('chargement', async () => {
    mockDonnees.chargement = true;
    await rendre();
    expect(screen.getByText('Chargement des interventions…')).toBeTruthy();
  });

  it('erreur de lecture : message et Réessayer', async () => {
    mockDonnees.erreur = 'Impossible de charger les signalements. Réessayez.';
    await rendre();
    expect(screen.getByText('Impossible de charger les signalements. Réessayez.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(mockDonnees.rafraichir).toHaveBeenCalled();
  });

  it('état vide', async () => {
    const gardes = mockDonnees.endroits;
    mockDonnees.endroits = [];
    await rendre();
    expect(screen.getByText('Aucune intervention à planifier avec ces filtres.')).toBeTruthy();
    mockDonnees.endroits = gardes;
  });
});

describe('calcul : cases à cocher et nombre d’interventions incluses', () => {
  const caseDe = (motif: RegExp) => screen.getByLabelText(motif);

  it('le bouton garde son libellé et annonce son contenu, avec l’accord singulier et pluriel', async () => {
    await rendre();
    expect(screen.getByText('Calculer le trajet optimal')).toBeTruthy();
    expect(a('2 interventions incluses')).toBe(true);
    await fireEvent.press(caseDe(/^Inclure dans le calcul : Accumulation d'eau/));
    expect(a('1 intervention incluse')).toBe(true);
  });

  it('une case par ligne, toutes cochées par défaut, avec l’état dans le libellé ; décocher retire l’endroit du calcul', async () => {
    const onCalculer = jest.fn();
    await render(<InterventionsAPlanifier onCalculer={onCalculer} onTableau={jest.fn()} />);
    const cases = screen.getAllByRole('checkbox');
    expect(cases).toHaveLength(2);
    expect(cases.every((c) => c.props.accessibilityState.checked)).toBe(true);
    expect(cases[0].props.accessibilityLabel).toMatch(/^Inclure dans le calcul : Égout bouché, /);
    await fireEvent.press(caseDe(/^Inclure dans le calcul : Égout bouché/));
    expect(caseDe(/^Inclure dans le calcul : Égout bouché/).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByLabelText(/^Calculer le trajet optimal pour 1 intervention$/));
    expect(onCalculer).toHaveBeenCalledWith(['b']); // seules les clés cochées partent
  });

  it('la case est distincte du toucher de la ligne : elle ne ouvre pas la fiche', async () => {
    await rendre();
    await fireEvent.press(caseDe(/^Inclure dans le calcul : Égout bouché/));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('« Tout décocher » : zéro inclus, bouton désactivé avec « Cochez au moins une intervention. » ; « Tout cocher » rétablit', async () => {
    const onCalculer = jest.fn();
    await render(<InterventionsAPlanifier onCalculer={onCalculer} onTableau={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Tout décocher'));
    expect(a('Aucune intervention incluse')).toBe(true);
    expect(screen.getByText('Cochez au moins une intervention.')).toBeTruthy();
    const bouton = screen.getByLabelText(/^Calculer le trajet optimal pour 0/);
    expect(bouton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(bouton);
    expect(onCalculer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Tout cocher'));
    expect(a('2 interventions incluses')).toBe(true);
  });

  it('les décochages survivent au changement de filtre ; un endroit arrivé en direct est inclus par défaut', async () => {
    const rendu = await render(<InterventionsAPlanifier onCalculer={jest.fn()} onTableau={jest.fn()} />);
    await fireEvent.press(caseDe(/^Inclure dans le calcul : Égout bouché/));
    await choisirEtat('Tous');
    await choisirEtat('À traiter');
    expect(caseDe(/^Inclure dans le calcul : Égout bouché/).props.accessibilityState.checked).toBe(false);
    expect(a('1 intervention incluse')).toBe(true);
    mockDonnees.endroits = [...mockDonnees.endroits, endroit('e', 'elevee', 'nouveau', [sig('9', 'nouveau', 'grille_endommagee', '2026-11-21T10:00:00Z')])];
    await rendu.rerender(<InterventionsAPlanifier onCalculer={jest.fn()} onTableau={jest.fn()} />);
    expect(a('2 interventions incluses')).toBe(true); // b + le nouvel endroit ; a reste décoché
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    mockDonnees.endroits = mockDonnees.endroits.filter((x) => x.cle !== 'e');
  });

  it('hors filtre calculable : ni cases, ni nombre ; la règle de l’état reste prioritaire sur « Cochez au moins une »', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Tout décocher'));
    await choisirEtat('Réglés');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/Le calcul ne porte que sur des endroits à traiter/)).toBeTruthy();
    expect(screen.queryByText('Cochez au moins une intervention.')).toBeNull();
    expect(screen.queryByText('Tout cocher')).toBeNull();
  });
});

describe('barre du bas du superviseur : quatre onglets', () => {
  it('Planifier, Calcul, Équipes, Traités ; plus d’onglet Alertes', async () => {
    await render(<SupervisorApp onLogout={jest.fn()} />);
    for (const nom of ['Interventions à planifier', 'Optimisation', 'Équipes', 'Arrêts traités']) expect(screen.getByLabelText(nom)).toBeTruthy();
    expect(screen.getAllByLabelText(/./).filter((x) => x.props.accessibilityRole === 'tab')).toHaveLength(4); // exactement quatre onglets
    expect(screen.queryByText('Alertes')).toBeNull();
    expect(screen.queryByLabelText('Alertes')).toBeNull();
  });
});

describe('lisibilité sous chaque thème : écran des interventions', () => {
  it.each(COMBINAISONS_THEMES)('thème %s %j', async (theme, lis) => {
    mockDonnees.endroits = [
      endroit('a', 'elevee', 'nouveau', [sig('1', 'nouveau', 'grille_bouchee', '2026-11-20T10:00:00Z')]),
      endroit('b', 'moyenne', 'pris_en_charge', [sig('2', 'pris_en_charge', 'eau_accumulee', '2026-11-20T11:00:00Z'), sig('3', 'nouveau', 'eau_accumulee', '2026-11-20T12:00:00Z')]),
    ];
    appliquerThemeEtLisibilite(theme, lis);
    await rendre();
    await fireEvent.press(screen.getAllByRole('checkbox')[0]); // une ligne décochée (atténuée)
    expect(textesIllisibles()).toEqual([]);
    expect(fondDeLaRacine()).toBe(lireMarque().jetons.background);
  });
});
