import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { BarreNavigation } from '../../src/components/ville/barre-navigation';
import { appliquerThemeEtLisibilite, COMBINAISONS_THEMES, textesIllisibles } from '../aide-tests/lisibilite';
import { definirTheme, reinitialiserMarque } from '../../src/marque/magasin';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const base = {
  principal: '4 min · 1,2 km',
  progression: 'Arrêt 1 sur 39 · reste 6 h 14',
  lieu: 'Égout bouché · Près de 900 place Jean-Paul-Riopelle',
  onAction: jest.fn(),
  onArreter: jest.fn(),
  onListe: jest.fn(),
};

beforeEach(() => reinitialiserMarque());

describe('panneau du bas de la navigation', () => {
  it('trois lignes : temps et distance, progression, problème et adresse ; UNE action principale', async () => {
    await render(<BarreNavigation {...base} />);
    expect(screen.getByText('4 min · 1,2 km')).toBeTruthy();
    expect(screen.getByText('Arrêt 1 sur 39 · reste 6 h 14')).toBeTruthy();
    expect(screen.getByText('Égout bouché · Près de 900 place Jean-Paul-Riopelle')).toBeTruthy();
    expect(screen.getByLabelText('Arrêt fait ?')).toBeTruthy();
    // les actions secondaires sont des boutons d'icône avec un libellé d'accessibilité, pas des boutons de texte
    expect(screen.getByLabelText('Liste des arrêts')).toBeTruthy();
    expect(screen.getByLabelText('Arrêter la navigation')).toBeTruthy();
    expect(screen.queryByText('Arrêter')).toBeNull();
    expect(screen.queryByText('Arrêts')).toBeNull();
  });

  it('les actions agissent : arrêt fait, liste, arrêter, retour', async () => {
    const onAction = jest.fn();
    const onListe = jest.fn();
    const onArreter = jest.fn();
    const onRetour = jest.fn();
    await render(<BarreNavigation {...base} onAction={onAction} onListe={onListe} onArreter={onArreter} onRetour={onRetour} />);
    await fireEvent.press(screen.getByLabelText('Arrêt fait ?'));
    await fireEvent.press(screen.getByLabelText('Liste des arrêts'));
    await fireEvent.press(screen.getByLabelText('Arrêter la navigation'));
    await fireEvent.press(screen.getByLabelText("Retour à l'écran précédent"));
    expect([onAction, onListe, onArreter, onRetour].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('l’avis de départ n’apparaît que quand il est utile, en pastille', async () => {
    const { rerender } = await render(<BarreNavigation {...base} />);
    expect(screen.queryByText(/du départ prévu/)).toBeNull();
    await rerender(<BarreNavigation {...base} info="Vous êtes à 380 m du départ prévu." />);
    expect(screen.getByText('Vous êtes à 380 m du départ prévu.')).toBeTruthy();
  });

  it('sans mesure de Google, la ligne principale est omise (pas de ligne vide)', async () => {
    await render(<BarreNavigation {...base} principal={null} />);
    expect(screen.queryByText('4 min · 1,2 km')).toBeNull();
    expect(screen.getByText('Arrêt 1 sur 39 · reste 6 h 14')).toBeTruthy();
  });

  it('le panneau a un fond opaque du thème et se fond avec une carte sombre (thème Nuit)', async () => {
    definirTheme('nuit');
    await render(<BarreNavigation {...base} />);
    const panneau = screen.getByTestId('panneau-navigation');
    const style = Array.isArray(panneau.props.style) ? Object.assign({}, ...panneau.props.style.flat(3).filter(Boolean)) : panneau.props.style;
    expect(style.backgroundColor).toBe('#161D28');
    expect(style.borderTopLeftRadius).toBe(30);
    expect(within(panneau).getByText('4 min · 1,2 km')).toBeTruthy();
  });

  it.each(COMBINAISONS_THEMES)('lisible sous le thème %s %j', async (theme, lis) => {
    appliquerThemeEtLisibilite(theme, lis);
    await render(<BarreNavigation {...base} info="Vous êtes à 380 m du départ prévu." arrivee="Vous êtes arrivé à l'arrêt 1" suggestion={{ texte: 'Vous êtes à l’arrêt 3 : le faire maintenant ?', titre: 'Arrêt 3 fait ?', onPress: jest.fn() }} onRetour={jest.fn()} />);
    expect(textesIllisibles()).toEqual([]);
  });
});
