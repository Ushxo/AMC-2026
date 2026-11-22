import { render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { Carte, Cercle, NAVIGATION_GOOGLE, Repere, Trace, Vehicule, Zone, type CarteCommandes } from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockAnimerRegion = jest.fn();
const mockAnimerCamera = jest.fn();
jest.mock('react-native-maps', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const Faux = ({ children, testID }: { children?: unknown; testID?: string }) => <View testID={testID}>{children as never}</View>;
  const Carte = React.forwardRef(({ children }: { children?: unknown }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimerRegion, animateCamera: mockAnimerCamera }));
    return <View testID="carte-native">{children as never}</View>;
  });
  Carte.displayName = 'Carte';
  return { __esModule: true, default: Carte, Marker: Faux, Polyline: Faux, Circle: Faux, Polygon: Faux, UrlTile: Faux, PROVIDER_GOOGLE: 'google' };
});

const region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.03, longitudeDelta: 0.04 };
const p = (lat: number, lng: number) => ({ latitude: lat, longitude: lng });

describe('couche de carte commune (implémentation react-native-maps par défaut)', () => {
  it('n’active pas la navigation Google hors build dédiée', () => {
    expect(NAVIGATION_GOOGLE).toBe(false);
  });

  it('affiche repères, véhicule, tracé, zone et cercle sans planter', async () => {
    await render(
      <Carte regionInitiale={region} accessibilityLabel="Carte d’essai">
        <Repere id="a" position={p(45.5, -73.57)} couleur="#2F7D32" etat="choisi" titre="Arrêt" />
        <Vehicule id="v" position={p(45.5, -73.57)} cap={90} />
        <Trace id="t" points={[p(45.5, -73.57), p(45.51, -73.56)]} couleur="#1F5FBF" epaisseur={4} />
        <Zone id="z" exterieur={[p(45.5, -73.57), p(45.51, -73.57), p(45.51, -73.56)]} fond="rgba(0,0,0,0.2)" contour="rgba(0,0,0,0.7)" epaisseur={2} />
        <Cercle id="c" centre={p(45.5, -73.57)} rayonM={30} fond="rgba(0,0,0,0.2)" contour="rgba(0,0,0,0.7)" epaisseur={2} />
      </Carte>,
    );
    expect(screen.getByTestId('carte-native')).toBeTruthy();
  });

  it('commandes de caméra : cadrer, centrer, suivre', async () => {
    const commandes = createRef<CarteCommandes>();
    await render(<Carte regionInitiale={region} commandes={commandes} />);
    commandes.current?.cadrer([p(45.5, -73.6), p(45.52, -73.5)]);
    expect(mockAnimerRegion).toHaveBeenCalledTimes(1);
    commandes.current?.centrer(p(45.51, -73.55));
    expect(mockAnimerRegion).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 45.51, longitude: -73.55 }), 400);
    commandes.current?.suivre(p(45.5, -73.57), 120);
    expect(mockAnimerCamera).toHaveBeenLastCalledWith(
      expect.objectContaining({ heading: 120, pitch: 55, center: p(45.5, -73.57) }),
      expect.anything(),
    );
  });
});
