import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import SupervisorApp from '../supervisor/SupervisorApp';
import { DECALAGE_HORS_ECRAN } from '../../src/components/mouvement/onglets-gardes';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/use-acces', () => ({ useAcces: () => ({ nom: 'Sup', demoHorsLigne: false }) }));

const rendus = { equipes: 0, rapports: 0, planifier: 0, calcul: 0, profil: 0 };
jest.mock('@/app/ville/equipes', () => ({
  EcranEquipes: () => {
    rendus.equipes++;
    return null;
  },
}));
jest.mock('@/app/ville/tournees', () => ({
  EcranTournees: () => {
    rendus.calcul++;
    return null;
  },
}));
jest.mock('../supervisor/ArretsFaits', () => ({
  __esModule: true,
  default: () => {
    rendus.rapports++;
    return null;
  },
}));
jest.mock('../supervisor/InterventionsAPlanifier', () => ({
  __esModule: true,
  default: () => {
    rendus.planifier++;
    return null;
  },
}));
jest.mock('../supervisor/TableauDeBord', () => ({ __esModule: true, default: () => null }));
jest.mock('../supervisor/TrajetOptimal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ville/liste-alertes', () => ({ ListeAlertes: () => null }));
jest.mock('../components/BoutonProfil', () => ({
  BoutonProfil: () => {
    rendus.profil++;
    return null;
  },
}));

const aplati = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;

describe('superviseur : 40 bascules Équipes et Traités', () => {
  it('aucun display, aucune taille changée, en-tête de hauteur constante, aucun rendu des écrans, profil rendu une fois', async () => {
    const { toJSON } = await render(<SupervisorApp onLogout={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Équipes'));
    await fireEvent.press(screen.getByLabelText('Arrêts traités'));
    const avant = { ...rendus };
    for (let i = 0; i < 40; i++) {
      await fireEvent.press(screen.getByLabelText(i % 2 === 0 ? 'Équipes' : 'Arrêts traités'));
    }
    // les écrans gardés ne sont jamais redessinés par les bascules
    expect(rendus.equipes).toBe(avant.equipes);
    expect(rendus.rapports).toBe(avant.rapports);
    expect(rendus.planifier).toBe(avant.planifier);
    expect(rendus.profil).toBeLessThanOrEqual(1);
    // aucun panneau n'a de display ni de taille propre : tous en absoluteFill, les cachés seulement décalés par transformation
    expect(JSON.stringify(toJSON())).not.toContain('"display":"none"');
    // en-tête : le sous-titre réserve deux lignes quelle que soit la page (hauteur constante)
    for (const nom of ['Équipes', 'Arrêts traités']) {
      await fireEvent.press(screen.getByLabelText(nom));
      const sous = screen.getByText(nom === 'Équipes' ? /Départ, arrivée et compte/ : /Ce que les équipes ont fait/);
      expect(sous.props.numberOfLines).toBe(2);
      expect(aplati(sous).minHeight).toBe(40);
    }
    // les panneaux cachés sont poussés hors écran, pas retirés
    const json = JSON.stringify(toJSON());
    expect(json).toContain(`"translateX":${DECALAGE_HORS_ECRAN}`);
    expect(rendus.equipes).toBe(avant.equipes);
  });
});
