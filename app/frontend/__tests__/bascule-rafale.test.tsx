import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CitizenApp from '../citizen/CitizenApp';
import { BarreOnglets } from '../components/BarreOnglets';
import { OngletsGardes, useOngletActif, useOngletActifRef } from '../../src/components/mouvement/onglets-gardes';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const compteurs = { carteRendus: 0, carteMontages: 0, alertesMontages: 0, lectures: 0, intervalles: 0, abonnements: 0 };
jest.mock('@/components/citoyen/ecran-carte', () => {
  const React = jest.requireActual('react');
  const { Text: T } = jest.requireActual('react-native');
  const { useOngletActifRef: lireActif } = jest.requireActual('../../src/components/mouvement/onglets-gardes');
  return {
    __esModule: true,
    // Carte simulée : mêmes règles que implementation-google (minuteur unique, lecture seulement onglet visible, une lecture en vol).
    default: function CarteSimulee() {
      compteurs.carteRendus++;
      const actif = lireActif();
      React.useEffect(() => {
        compteurs.carteMontages++;
        compteurs.abonnements++;
        compteurs.intervalles++;
        let enVol = false;
        const t = setInterval(() => {
          if (!actif.current() || enVol) return;
          enVol = true;
          compteurs.lectures++;
          Promise.resolve().then(() => {
            enVol = false;
          });
        }, 600);
        return () => {
          clearInterval(t);
          compteurs.abonnements--;
        };
      }, [actif]);
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
      React.useEffect(() => {
        compteurs.alertesMontages++;
      }, []);
      return <T>mes alertes</T>;
    },
  };
});
jest.mock('@/components/profil/feuille-profil', () => ({ FeuilleProfil: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reanimated = require('react-native-reanimated') as { __compteurs: { springs: number; timings: number; annulations: number } };

const style = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const translateX = (n: { props: { style?: unknown } }) => ((style(n).transform as { translateX?: number }[] | undefined) ?? []).find((t) => t.translateX !== undefined)?.translateX;

// Suite pseudo-aléatoire reproductible (la même rafale à chaque exécution).
function alea(graine: number) {
  let s = graine;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('rafale de touchers sur la barre du bas', () => {
  let erreurs: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    Object.keys(compteurs).forEach((k) => ((compteurs as Record<string, number>)[k] = 0));
    reanimated.__compteurs.springs = 0;
    reanimated.__compteurs.timings = 0;
    reanimated.__compteurs.annulations = 0;
    erreurs = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    erreurs.mockRestore();
    jest.useRealTimers();
  });

  it('citoyen, 40 bascules : la carte n’est ni remontée ni redessinée, aucune lecture de caméra ajoutée', async () => {
    await render(<CitizenApp compteConnecte={false} onLogout={() => {}} onStaffLogin={() => {}} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    const avant = { ...compteurs };
    for (let i = 0; i < 40; i++) {
      await fireEvent.press(screen.getByText(i % 2 === 0 ? 'Mes alertes' : 'Carte'));
    }
    expect(compteurs.carteMontages).toBe(1);
    expect(compteurs.alertesMontages).toBe(1);
    expect(compteurs.carteRendus).toBe(avant.carteRendus); // 0 rendu de la carte pour 40 bascules (avant : 40)
    expect(compteurs.intervalles).toBe(1); // 1 minuteur (avant : 21 redémarrages)
    expect(compteurs.abonnements).toBe(1);
    // Une lecture au repos toutes les 600 ms, et seulement carte visible : jamais pendant que l'onglet est caché.
    await fireEvent.press(screen.getByText('Mes alertes'));
    const lecturesAvant = compteurs.lectures;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(compteurs.lectures).toBe(lecturesAvant); // carte cachée : aucune lecture native
    // eslint-disable-next-line no-console
    console.info('mesure citoyen 40 bascules :', { ...compteurs, springs: reanimated.__compteurs.springs, timings: reanimated.__compteurs.timings });
    expect(erreurs).not.toHaveBeenCalled();
  });

  it.each([
    ['citoyen (2 onglets)', 2],
    ['admin (3 onglets)', 3],
    ['superviseur (4 onglets)', 4],
  ])('rafale de 30 touchers aléatoires, %s : affichage, pastille et « sélectionné » suivent le DERNIER toucher', async (_nom, n) => {
    const ids = Array.from({ length: n }, (_, i) => `o${i}`);
    const montages: Record<string, number> = {};
    function Contenu({ id }: { id: string }) {
      useEffect(() => {
        montages[id] = (montages[id] ?? 0) + 1;
      }, [id]);
      return <Text>{`contenu ${id}`}</Text>;
    }
    function Coque() {
      const [actif, setActif] = useState(ids[0]);
      return (
        <View style={{ flex: 1 }}>
          <OngletsGardes actif={actif} onglets={ids.map((id) => ({ id, rendu: () => <Contenu id={id} /> }))} />
          <BarreOnglets
            onglets={ids.map((id, i) => ({ id, label: `Onglet ${i}`, icon: 'home-outline' as const, iconActive: 'home' as const }))}
            actif={actif}
            onChange={setActif}
          />
        </View>
      );
    }
    await render(<Coque />);
    for (let i = 0; i < n; i++) {
      await fireEvent(screen.getByLabelText(`Onglet ${i}`), 'layout', { nativeEvent: { layout: { x: 4 + i * 100, y: 8, width: 96, height: 56 } } });
    }
    const hasard = alea(42);
    let dernier = 0;
    for (let i = 0; i < 30; i++) {
      dernier = Math.floor(hasard() * n);
      await fireEvent.press(screen.getByLabelText(`Onglet ${dernier}`));
    }
    // onglet affiché = dernier toucher
    expect(screen.getByText(`contenu o${dernier}`)).toBeTruthy();
    ids.forEach((id, i) => {
      if (i !== dernier) expect(screen.queryByText(`contenu ${id}`)).toBeNull(); // les autres sont cachés au lecteur d'écran
    });
    // pastille et état d'accessibilité = dernier toucher
    expect(translateX(screen.getByTestId('pastille-onglet', { includeHiddenElements: true }))).toBe(4 + dernier * 100);
    ids.forEach((_id, i) => expect(screen.getByLabelText(`Onglet ${i}`).props.accessibilityState.selected).toBe(i === dernier));
    // jamais monté deux fois
    Object.values(montages).forEach((m) => expect(m).toBe(1));
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('toucher l’onglet déjà actif ne fait rien', async () => {
    const onChange = jest.fn();
    await render(<BarreOnglets onglets={[{ id: 'a', label: 'Un', icon: 'home-outline', iconActive: 'home' }, { id: 'b', label: 'Deux', icon: 'list-outline', iconActive: 'list' }]} actif="a" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Un'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('le contexte d’onglet ne redessine que les abonnés à useOngletActif ; la lecture par ref ne redessine rien', async () => {
    const rendus = { abonne: 0, ref: 0 };
    function Abonne() {
      rendus.abonne++;
      return <Text>{useOngletActif() ? 'visible' : 'cache'}</Text>;
    }
    function ParRef() {
      rendus.ref++;
      const actif = useOngletActifRef();
      return <Text>{actif.current() ? 'visible' : 'cache'}</Text>;
    }
    function Coque() {
      const [actif, setActif] = useState('a');
      return (
        <View>
          <Text onPress={() => setActif((a) => (a === 'a' ? 'b' : 'a'))}>bascule</Text>
          <OngletsGardes
            actif={actif}
            onglets={[
              { id: 'a', rendu: () => <Abonne /> },
              { id: 'b', rendu: () => <ParRef /> },
            ]}
          />
        </View>
      );
    }
    await render(<Coque />);
    await fireEvent.press(screen.getByText('bascule'));
    const avant = { ...rendus };
    for (let i = 0; i < 20; i++) await fireEvent.press(screen.getByText('bascule'));
    expect(rendus.ref).toBe(avant.ref); // aucun rendu pour le consommateur par ref
    expect(rendus.abonne).toBeGreaterThan(avant.abonne); // l'abonné se redessine, lui seul
  });
});
