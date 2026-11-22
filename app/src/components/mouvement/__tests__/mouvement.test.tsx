import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import { BarreOnglets } from '../../../../frontend/components/BarreOnglets';
import { EcranOuverture } from '../../../../frontend/components/EcranOuverture';
import { Appuyable } from '../../appuyable';
import { FeuilleArrets } from '../../ville/feuille-arrets';
import { BoutonAction, DUREE_SUCCES_MS } from '../../bouton-action';
import { ApparitionDouce } from '../apparition-douce';
import { BulleAide } from '../bulle-aide';
import { ChiffreGlissant, INTERVALLE_ANIMATION_MS } from '../chiffre-glissant';
import { IconeAnimee } from '../icone-animee';
import { ModaleAnimee, PART_HAUTEUR_MAX } from '../modale-animee';
import { PastilleGlissante } from '../pastille-glissante';
import { RebondEchelle } from '../rebond-echelle';
import { DELAI_AIDE_MS, DUREE_AIDE_MS, reinitialiserAides, useAideUneFois } from '../use-aide-une-fois';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reanimated = require('react-native-reanimated') as { __definirMouvementReduit: (v: boolean) => void };

const aplati = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const translateX = (n: { props: { style?: unknown } }) => ((aplati(n).transform as { translateX?: number }[] | undefined) ?? []).find((t) => t.translateX !== undefined)?.translateX;
const echelle = (n: { props: { style?: unknown } }) => ((aplati(n).transform as { scale?: number }[] | undefined) ?? []).find((t) => t.scale !== undefined)?.scale;

describe.each([false, true])('mouvements de l’interface, animations réduites : %s', (reduit) => {
  beforeEach(() => {
    reanimated.__definirMouvementReduit(reduit);
    jest.useFakeTimers();
    reinitialiserAides();
  });
  afterEach(() => {
    jest.useRealTimers();
    reanimated.__definirMouvementReduit(false);
  });

  it('IconeAnimee : montre l’icône, et la nouvelle quand elle change', async () => {
    const { rerender, toJSON } = await render(<IconeAnimee nom="flash-off" taille={22} couleur="#000000" />);
    const glyphe = (nom: keyof typeof Ionicons.glyphMap) => String.fromCodePoint(Ionicons.glyphMap[nom] as number);
    expect(JSON.stringify(toJSON())).toContain(glyphe('flash-off'));
    await rerender(<IconeAnimee nom="flash" taille={22} couleur="#000000" />);
    expect(JSON.stringify(toJSON())).toContain(glyphe('flash'));
  });

  it('RebondEchelle : rend ses enfants', async () => {
    await render(
      <RebondEchelle actif>
        <Text>contenu</Text>
      </RebondEchelle>,
    );
    expect(screen.getByText('contenu')).toBeTruthy();
  });

  it('ApparitionDouce : affichée ou retirée selon visible', async () => {
    const { rerender } = await render(
      <ApparitionDouce visible>
        <Text>coche</Text>
      </ApparitionDouce>,
    );
    expect(screen.getByText('coche')).toBeTruthy();
    await rerender(
      <ApparitionDouce visible={false}>
        <Text>coche</Text>
      </ApparitionDouce>,
    );
    expect(screen.queryByText('coche')).toBeNull();
  });

  it('PastilleGlissante : se pose au premier affichage, puis rejoint le nouvel onglet', async () => {
    const a = { x: 4, y: 8, largeur: 100, hauteur: 56 };
    const b = { x: 108, y: 8, largeur: 100, hauteur: 56 };
    const { rerender } = await render(<PastilleGlissante testID="p" cible={a} />);
    expect(translateX(screen.getByTestId('p', { includeHiddenElements: true }))).toBe(4);
    await rerender(<PastilleGlissante testID="p" cible={b} />);
    expect(translateX(screen.getByTestId('p', { includeHiddenElements: true }))).toBe(108);
    expect(aplati(screen.getByTestId('p', { includeHiddenElements: true })).width).toBe(100);
  });

  it('BarreOnglets : la pastille change d’onglet au toucher, l’action n’est jamais retardée', async () => {
    const onChange = jest.fn();
    const onglets = [
      { id: 'a', label: 'Un', icon: 'home-outline' as const, iconActive: 'home' as const },
      { id: 'b', label: 'Deux', icon: 'list-outline' as const, iconActive: 'list' as const },
    ];
    const { rerender } = await render(<BarreOnglets onglets={onglets} actif="a" onChange={onChange} />);
    await fireEvent(screen.getByLabelText('Un'), 'layout', { nativeEvent: { layout: { x: 4, y: 8, width: 120, height: 56 } } });
    await fireEvent(screen.getByLabelText('Deux'), 'layout', { nativeEvent: { layout: { x: 128, y: 8, width: 120, height: 56 } } });
    expect(translateX(screen.getByTestId('pastille-onglet', { includeHiddenElements: true }))).toBe(4);
    await fireEvent.press(screen.getByLabelText('Deux'));
    expect(onChange).toHaveBeenCalledWith('b'); // l'action part tout de suite
    await rerender(<BarreOnglets onglets={onglets} actif="b" onChange={onChange} />);
    expect(translateX(screen.getByTestId('pastille-onglet', { includeHiddenElements: true }))).toBe(128);
    expect(screen.getByLabelText('Deux').props.accessibilityState.selected).toBe(true);
  });

  it('Appuyable : l’action part, l’opacité change tout de suite, l’échelle baisse seulement avec animations', async () => {
    const onPress = jest.fn();
    await render(
      <Appuyable testID="b" onPress={onPress} style={{ minHeight: 48 }}>
        <Text>Bouton</Text>
      </Appuyable>,
    );
    await fireEvent(screen.getByTestId('b'), 'pressIn');
    expect(aplati(screen.getByTestId('b')).opacity).toBe(0.78);
    expect(echelle(screen.getByTestId('b'))).toBe(reduit ? 1 : 0.97);
    await fireEvent(screen.getByTestId('b'), 'pressOut');
    expect(echelle(screen.getByTestId('b'))).toBe(1);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('BoutonAction : libellé, en cours, puis coche de réussite une demi-seconde, sans changer la taille du bouton', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<BoutonAction titre="Enregistrer" onPress={onPress} />);
    const avant = aplati(screen.getByLabelText('Enregistrer'));
    expect(screen.getByText('Enregistrer')).toBeTruthy();
    await rerender(<BoutonAction titre="Enregistrer" occupe onPress={onPress} />);
    expect(aplati(screen.getByLabelText('Enregistrer')).minHeight).toBe(avant.minHeight);
    await rerender(<BoutonAction titre="Enregistrer" succes onPress={onPress} />);
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(screen.queryByText('Enregistrer')).toBeNull(); // la coche remplace le libellé
    expect(screen.getByLabelText('Enregistrer')).toBeTruthy(); // le nom accessible reste
    await act(async () => {
      jest.advanceTimersByTime(DUREE_SUCCES_MS + 20);
    });
    expect(screen.getByText('Enregistrer')).toBeTruthy();
    expect(aplati(screen.getByLabelText('Enregistrer')).minHeight).toBe(avant.minHeight);
    expect(aplati(screen.getByLabelText('Enregistrer')).width).toBe(avant.width);
  });

  it('ChiffreGlissant : la bonne valeur en moins de 300 ms, l’ancienne ne reste jamais', async () => {
    const { rerender } = await render(<ChiffreGlissant valeur={12} style={{ fontSize: 16 }} />);
    expect(screen.getByLabelText('12')).toBeTruthy();
    await rerender(<ChiffreGlissant valeur={13} style={{ fontSize: 16 }} />);
    expect(screen.getByLabelText('13')).toBeTruthy(); // le lecteur d'écran lit tout de suite la valeur à jour
    expect(screen.getByText('13', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByText('12', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('13')).toBeTruthy();
  });

  it('ChiffreGlissant : cinq changements en une seconde = une seule animation, la dernière valeur tout de suite', async () => {
    const { rerender } = await render(<ChiffreGlissant valeur="4 min · 1,3 km" style={{ fontSize: 16 }} />);
    await rerender(<ChiffreGlissant valeur="4 min · 1,2 km" style={{ fontSize: 16 }} />); // première : animée (si animations)
    for (const v of ['4 min · 1,1 km', '3 min · 1,0 km', '3 min · 950 m', '3 min · 900 m']) {
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await rerender(<ChiffreGlissant valeur={v} style={{ fontSize: 16 }} />);
      expect(screen.getByLabelText(v)).toBeTruthy();
    }
    // une seule valeur « sortante » à la fois, jamais une pile d'anciennes valeurs
    expect(screen.getByText('3 min · 900 m', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('4 min · 1,2 km', { includeHiddenElements: true })).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(INTERVALLE_ANIMATION_MS);
    });
    expect(screen.queryByText('3 min · 950 m', { includeHiddenElements: true })).toBeNull();
  });

  it('ModaleAnimee : montre la feuille, appelle onFermer au toucher du voile, se retire après la sortie', async () => {
    const onFermer = jest.fn();
    const { rerender } = await render(
      <ModaleAnimee visible onFermer={onFermer} libelleFermer="Fermer le test">
        <View>
          <Text>feuille</Text>
        </View>
      </ModaleAnimee>,
    );
    expect(screen.getByText('feuille')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fermer le test'));
    expect(onFermer).toHaveBeenCalled();
    await rerender(
      <ModaleAnimee visible={false} onFermer={onFermer}>
        <View>
          <Text>feuille</Text>
        </View>
      </ModaleAnimee>,
    );
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.queryByText('feuille')).toBeNull();
  });

  it('BulleAide : affiche son texte, ne prend aucun toucher, disparaît quand on la ferme', async () => {
    const { rerender } = await render(<BulleAide visible texte="Touchez ici" />);
    expect(screen.getByText('Touchez ici')).toBeTruthy();
    await rerender(<BulleAide visible={false} texte="Touchez ici" />);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Touchez ici')).toBeNull();
  });

  it('EcranOuverture : le nom de l’organisation et « Propulsé par Priorix »', async () => {
    await render(<EcranOuverture />);
    expect(screen.getByText(/^Ouverture de /)).toBeTruthy();
    expect(screen.getByText('Propulsé par Priorix')).toBeTruthy();
  });
});

describe('feuille plafonnée à la hauteur de l’écran', () => {
  it('une feuille de 60 arrêts ne dépasse jamais 90 % de la fenêtre moins la zone sûre, en points (jamais en pourcentage)', async () => {
    const hauteur = Dimensions.get('window').height;
    const arrets = Array.from({ length: 60 }, (_, i) => ({
      id: `A${i + 1}`, rang: i + 1, cle_endroit: `c${i + 1}`, signalement_ids: ['s'], position: { latitude: 45.5, longitude: -73.57 },
      arrivee_prevue: '2026-11-22T12:00:00Z', depart_prevu: '2026-11-22T12:10:00Z',
    }));
    await render(<FeuilleArrets visible arrets={arrets} onFermer={jest.fn()} />);
    const feuille = aplati(screen.getByTestId('feuille-arrets'));
    expect(feuille.maxHeight).toBe(PART_HAUTEUR_MAX * hauteur - 47);
    expect(feuille.flexShrink).toBe(1);
    expect(typeof feuille.maxHeight).toBe('number');
  });

  it('plafonne toute feuille donnée en enfant, même sans maxHeight chez elle', async () => {
    const hauteur = Dimensions.get('window').height;
    await render(
      <ModaleAnimee visible onFermer={jest.fn()}>
        <View testID="f" style={{ maxHeight: '90%' }}>
          <Text>feuille</Text>
        </View>
      </ModaleAnimee>,
    );
    expect(aplati(screen.getByTestId('f')).maxHeight).toBe(PART_HAUTEUR_MAX * hauteur - 47);
  });
});

describe('aide montrée une seule fois', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reinitialiserAides();
  });
  afterEach(() => jest.useRealTimers());

  function Sonde({ cle }: { cle: string }) {
    const { visible, fermer } = useAideUneFois(cle);
    return (
      <Text onPress={fermer} testID="sonde">
        {visible ? 'visible' : 'cachee'}
      </Text>
    );
  }

  it('visible à la première ouverture seulement ; un toucher la ferme ; sinon elle s’efface seule', async () => {
    const AsyncStorage = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
    await AsyncStorage.clear?.();
    const { unmount } = await render(<Sonde cle="signaler" />);
    expect(screen.getByTestId('sonde').props.children).toBe('cachee');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DELAI_AIDE_MS + 50);
    });
    expect(screen.getByTestId('sonde').props.children).toBe('visible');
    await fireEvent.press(screen.getByTestId('sonde'));
    expect(screen.getByTestId('sonde').props.children).toBe('cachee');
    await unmount();
    // deuxième ouverture : mémorisée, jamais revue
    reinitialiserAides();
    await render(<Sonde cle="signaler" />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DELAI_AIDE_MS + DUREE_AIDE_MS);
    });
    expect(screen.getByTestId('sonde').props.children).toBe('cachee');
  });

  it('sans toucher, elle disparaît d’elle-même', async () => {
    const AsyncStorage = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
    await AsyncStorage.clear?.();
    await render(<Sonde cle="autre" />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DELAI_AIDE_MS + 50);
    });
    expect(screen.getByTestId('sonde').props.children).toBe('visible');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DUREE_AIDE_MS + 50);
    });
    expect(screen.getByTestId('sonde').props.children).toBe('cachee');
  });
});
