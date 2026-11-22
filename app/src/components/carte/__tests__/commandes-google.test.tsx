import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { Carte } from '../implementation-google';
import { reinitialiserNotes } from '../appel-controleur';
import type { CarteCommandes } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const erreurNative = (_arg?: unknown) => Promise.reject(new Error('No view controller found for the specified nativeID'));
const controleur = {
  moveCamera: jest.fn(erreurNative as (c: { target: unknown }) => Promise<never>),
  getCameraPosition: jest.fn(erreurNative),
  addMarker: jest.fn(erreurNative),
  removeMarker: jest.fn(erreurNative),
};
const vue: { cree: ((c: unknown) => void) | null; prete: (() => void) | null } = { cree: null, prete: null };
jest.mock('@googlemaps/react-native-navigation-sdk', () => ({
  MapColorScheme: { DARK: 1, LIGHT: 0 },
  MapView: (props: { onMapViewControllerCreated?: (c: unknown) => void; onMapReady?: () => void }) => {
    vue.cree = props.onMapViewControllerCreated ?? null;
    vue.prete = props.onMapReady ?? null;
    return null;
  },
}));

const position = { latitude: 45.5, longitude: -73.57 };
const region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.03, longitudeDelta: 0.04 };
const rejetsNonGeres: unknown[] = [];
const ecouteur = (e: unknown) => rejetsNonGeres.push(e);

async function monter() {
  const commandes = createRef<CarteCommandes>();
  const rendu = await render(<Carte regionInitiale={region} commandes={commandes} accessibilityLabel="Carte d’essai" />);
  await fireEvent(screen.getByLabelText('Carte d’essai'), 'layout', { nativeEvent: { layout: { width: 320, height: 520 } } });
  return { commandes, rendu };
}
const attendre = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  Object.values(controleur).forEach((f) => f.mockClear());
  vue.cree = null;
  vue.prete = null;
  rejetsNonGeres.length = 0;
  reinitialiserNotes();
  process.on('unhandledRejection', ecouteur);
});
afterEach(() => process.off('unhandledRejection', ecouteur));

describe('ordres au contrôleur de la carte Google', () => {
  it('un ordre de centrage envoyé AVANT « prête » est gardé et rejoué une fois, après', async () => {
    const { commandes } = await monter();
    commandes.current?.surPosition(position, 400);
    expect(controleur.moveCamera).not.toHaveBeenCalled();
    await act(async () => {
      vue.cree?.(controleur);
      vue.prete?.();
    });
    await attendre();
    expect(controleur.moveCamera).toHaveBeenCalledTimes(1);
    expect((controleur.moveCamera.mock.calls[0][0] as { target: unknown }).target).toEqual({ lat: 45.5, lng: -73.57 });
  });

  it('seul le DERNIER ordre donné avant « prête » est rejoué', async () => {
    const { commandes } = await monter();
    commandes.current?.surPosition(position, 400);
    commandes.current?.surPosition({ latitude: 45.51, longitude: -73.56 }, 400);
    await act(async () => {
      vue.cree?.(controleur);
      vue.prete?.();
    });
    await attendre();
    expect(controleur.moveCamera).toHaveBeenCalledTimes(1);
    expect((controleur.moveCamera.mock.calls[0][0] as { target: unknown }).target).toEqual({ lat: 45.51, lng: -73.56 });
  });

  it('un contrôleur qui rejette « No view controller found » ne produit aucun rejet non géré, et n’est noté qu’une fois', async () => {
    const avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { commandes } = await monter();
    await act(async () => {
      vue.cree?.(controleur);
      vue.prete?.();
    });
    for (let i = 0; i < 5; i++) commandes.current?.suivre(position, 90);
    commandes.current?.centrer(position);
    await attendre();
    await attendre();
    expect(controleur.moveCamera).toHaveBeenCalledTimes(5);
    expect(rejetsNonGeres).toEqual([]);
    const notes = avertir.mock.calls.filter((c) => String(c[0]).includes('carte Google : moveCamera'));
    expect(notes).toHaveLength(1); // une seule note, pas une par appel
    avertir.mockRestore();
  });

  it('après le démontage de la vue, plus aucun ordre n’atteint le contrôleur', async () => {
    const { commandes, rendu } = await monter();
    await act(async () => {
      vue.cree?.(controleur);
      vue.prete?.();
    });
    await rendu.unmount();
    commandes.current?.surPosition(position, 400);
    commandes.current?.suivre(position, 0);
    await attendre();
    expect(controleur.moveCamera).not.toHaveBeenCalled();
    expect(rejetsNonGeres).toEqual([]);
  });
});
