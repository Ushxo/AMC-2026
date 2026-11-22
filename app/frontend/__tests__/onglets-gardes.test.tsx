import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarreOnglets } from '../components/BarreOnglets';
import CitizenApp from '../citizen/CitizenApp';
import { OngletsGardes, useOngletActif } from '../../src/components/mouvement/onglets-gardes';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const compteurs = { carteMontages: 0, carteRendus: 0, alertesMontages: 0, alertesRendus: 0 };
jest.mock('@/components/citoyen/ecran-carte', () => {
  const React = jest.requireActual('react');
  const { Text: T } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function CarteSimulee() {
      compteurs.carteRendus++;
      React.useEffect(() => {
        compteurs.carteMontages++;
      }, []);
      return <T>carte native</T>;
    },
  };
});
jest.mock('../citizen/MyAlerts', () => {
  const React = jest.requireActual('react');
  const { Text: T } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function AlertesSimulees() {
      compteurs.alertesRendus++;
      React.useEffect(() => {
        compteurs.alertesMontages++;
      }, []);
      return <T>mes alertes</T>;
    },
  };
});
jest.mock('@/components/profil/feuille-profil', () => ({ FeuilleProfil: () => null }));

const style = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const translateX = (n: { props: { style?: unknown } }) => ((style(n).transform as { translateX?: number }[] | undefined) ?? []).find((t) => t.translateX !== undefined)?.translateX;

describe('onglets gardés montés', () => {
  beforeEach(() => {
    Object.keys(compteurs).forEach((k) => ((compteurs as Record<string, number>)[k] = 0));
  });

  it('un onglet visité n’est jamais remonté ni redessiné quand on change d’onglet (carte, alertes, carte, alertes, carte)', async () => {
    await render(<CitizenApp compteConnecte={false} onLogout={() => {}} onStaffLogin={() => {}} />);
    for (const nom of ['Mes alertes', 'Carte', 'Mes alertes', 'Carte']) {
      await fireEvent.press(screen.getByText(nom));
    }
    // Avant : l'écran était démonté et remonté à chaque changement (carte 3 montages, alertes 2). Maintenant : un seul montage chacun.
    expect(compteurs.carteMontages).toBe(1);
    expect(compteurs.alertesMontages).toBe(1);
    // Aucun rendu de plus pour les onglets déjà montés.
    expect(compteurs.carteRendus).toBe(1);
    expect(compteurs.alertesRendus).toBe(1);
  });

  it('l’onglet caché ne reçoit aucun toucher et est masqué au lecteur d’écran ; la carte cachée garde sa taille', async () => {
    function Onglets({ actif }: { actif: string }) {
      return (
        <OngletsGardes
          actif={actif}
          onglets={[
            { id: 'carte', gardeTaille: true, rendu: () => <Text>carte</Text> },
            { id: 'liste', rendu: () => <Text>liste</Text> },
          ]}
        />
      );
    }
    const { rerender, toJSON } = await render(<Onglets actif="carte" />);
    expect(screen.queryByText('liste', { includeHiddenElements: true })).toBeNull(); // pas encore visité : pas monté
    await rerender(<Onglets actif="liste" />);
    const racine = (toJSON() as { children: { props: Record<string, unknown> }[] }).children;
    const [panCarte, panListe] = racine;
    expect(panCarte.props.pointerEvents).toBe('none');
    expect(panCarte.props.accessibilityElementsHidden).toBe(true);
    expect(StyleSheet.flatten(panCarte.props.style as never)).toMatchObject({ opacity: 0 }); // gardée mesurée, invisible
    expect(StyleSheet.flatten(panCarte.props.style as never).display).toBeUndefined();
    expect(panListe.props.pointerEvents).toBe('auto');
    await rerender(<Onglets actif="carte" />);
    const [c2, l2] = (toJSON() as { children: { props: Record<string, unknown> }[] }).children;
    expect(l2.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(l2.props.style as never)).toMatchObject({ display: 'none' }); // retirée de la mise en page
    expect(c2.props.pointerEvents).toBe('auto');
  });

  it('useOngletActif dit si l’onglet est visible ; le contenu ne se redessine que si ses dépendances changent', async () => {
    const rendus: Record<string, number> = { a: 0, b: 0 };
    function Sonde({ id }: { id: string }) {
      rendus[id]++;
      const actif = useOngletActif();
      return <Text testID={id}>{actif ? 'visible' : 'cache'}</Text>;
    }
    function Coquille() {
      const [actif, setActif] = useState('a');
      const [versionA, setVersionA] = useState(0);
      return (
        <View>
          <Text onPress={() => setActif('b')}>vers b</Text>
          <Text onPress={() => setVersionA((v) => v + 1)}>maj a</Text>
          <OngletsGardes
            actif={actif}
            onglets={[
              { id: 'a', deps: [versionA], rendu: () => <Sonde id="a" /> },
              { id: 'b', rendu: () => <Sonde id="b" /> },
            ]}
          />
        </View>
      );
    }
    await render(<Coquille />);
    await fireEvent.press(screen.getByText('vers b'));
    expect(screen.getByTestId('a', { includeHiddenElements: true }).props.children).toBe('cache');
    expect(screen.getByTestId('b').props.children).toBe('visible');
    const avant = rendus.a;
    await fireEvent.press(screen.getByText('maj a')); // dépendance de a : il se redessine
    expect(rendus.a).toBeGreaterThan(avant);
  });
});

describe('changement d’onglet en deux temps', () => {
  it('la pastille rejoint l’onglet touché tout de suite, même si le contenu n’a pas encore changé', async () => {
    const onChange = jest.fn(); // le parent ne change pas encore l'onglet actif (contenu en transition)
    const onglets = [
      { id: 'a', label: 'Un', icon: 'home-outline' as const, iconActive: 'home' as const },
      { id: 'b', label: 'Deux', icon: 'list-outline' as const, iconActive: 'list' as const },
    ];
    await render(<BarreOnglets onglets={onglets} actif="a" onChange={onChange} />);
    await fireEvent(screen.getByLabelText('Un'), 'layout', { nativeEvent: { layout: { x: 4, y: 8, width: 120, height: 56 } } });
    await fireEvent(screen.getByLabelText('Deux'), 'layout', { nativeEvent: { layout: { x: 128, y: 8, width: 120, height: 56 } } });
    await fireEvent.press(screen.getByLabelText('Deux'));
    expect(translateX(screen.getByTestId('pastille-onglet', { includeHiddenElements: true }))).toBe(128);
    expect(screen.getByLabelText('Deux').props.accessibilityState.selected).toBe(true);
    expect(onChange).toHaveBeenCalledWith('b');
    await act(async () => {});
  });
});
