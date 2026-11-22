import { useImperativeHandle, useRef } from 'react';
import type MapView from 'react-native-maps';
import { Circle, Polygon, Polyline } from 'react-native-maps';

import { CarteCommune } from '@/components/ville/carte-commune';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { MarqueurVehicule } from '@/components/ville/marqueur-vehicule';
import { deltasPourRayon } from '@/lib/position-citoyen';
import { regionAutour } from '@/lib/trajet';

import type { CarteProps, CercleProps, RepereGroupeProps, RepereProps, TraceProps, VehiculeProps, ZoneProps } from './types';

const ALTITUDE_SUIVI_M = 700; // Apple Plans n'a pas de zoom : altitude de la caméra
const ZOOM_SUIVI = 17;
const INCLINAISON_SUIVI = 55;

/** Zone qui contient ces points avec 30 % de marge (étendue minimale d'environ 200 m). */
function regionPourPoints(points: { latitude: number; longitude: number }[]) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.002, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.003, (maxLng - minLng) * 1.6),
  };
}

/** Implémentation react-native-maps (Expo Go, repli, build sans navigation Google). */
export function Carte({ commandes, children, regionInitiale, onPress, onRegionChangeComplete, onDeplacement, onTaille, positionUtilisateur, ...reste }: CarteProps) {
  const carte = useRef<MapView>(null);
  useImperativeHandle(commandes, () => ({
    cadrer: (points) => {
      if (points.length === 0) return;
      carte.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 300 });
      carte.current?.animateToRegion(regionAutour(points, regionInitiale), 500);
    },
    zoomer: (points) => {
      if (points.length === 0) return;
      carte.current?.animateToRegion(regionPourPoints(points), 500);
    },
    surPosition: (position, rayonM) => {
      carte.current?.animateToRegion({ ...position, ...deltasPourRayon(position, rayonM) }, 600);
    },
    centrer: (position) => {
      carte.current?.animateToRegion({ ...regionInitiale, latitude: position.latitude, longitude: position.longitude }, 400);
    },
    suivre: (position, cap) => {
      carte.current?.animateCamera(
        { center: position, pitch: INCLINAISON_SUIVI, heading: cap ?? 0, zoom: ZOOM_SUIVI, altitude: ALTITUDE_SUIVI_M },
        { duration: 800 },
      );
    },
  }));
  return (
    <CarteCommune
      ref={carte}
      initialRegion={regionInitiale}
      onPress={onPress ? (e) => onPress(e.nativeEvent.coordinate) : undefined}
      onRegionChangeComplete={onRegionChangeComplete}
      onPanDrag={onDeplacement}
      showsUserLocation={!!positionUtilisateur}
      showsMyLocationButton={false}
      onLayout={onTaille ? (e) => onTaille({ largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height }) : undefined}
      {...reste}>
      {children}
    </CarteCommune>
  );
}

export function RepereGroupe({ position, couleur, nombre, pointEleve, marque, onPress, zIndex, accessibilityLabel }: RepereGroupeProps) {
  return (
    <MarqueurEgout
      coordinate={position}
      couleur={couleur}
      etat="groupe"
      numero={nombre}
      pointEleve={pointEleve}
      marque={marque}
      onPress={onPress}
      zIndex={zIndex}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function Repere({ position, couleur, etat, numero, titre, description, onPress, onBulle, zIndex, accessibilityLabel }: RepereProps) {
  return (
    <MarqueurEgout
      coordinate={position}
      couleur={couleur}
      etat={etat}
      numero={numero}
      title={titre}
      description={description}
      onPress={onPress}
      onCalloutPress={onBulle}
      zIndex={zIndex}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function Vehicule({ position, cap, titre, description, accessibilityLabel }: VehiculeProps) {
  return <MarqueurVehicule coordinate={position} cap={cap} title={titre} description={description} accessibilityLabel={accessibilityLabel} />;
}

export function Trace({ points, couleur, epaisseur }: TraceProps) {
  return <Polyline coordinates={points} strokeColor={couleur} strokeWidth={epaisseur} lineJoin="round" lineCap="round" />;
}

export function Zone({ exterieur, trous, fond, contour, epaisseur, onPress }: ZoneProps) {
  return (
    <Polygon
      coordinates={exterieur}
      holes={trous}
      fillColor={fond}
      strokeColor={contour}
      strokeWidth={epaisseur}
      zIndex={0}
      tappable={!!onPress}
      onPress={onPress}
    />
  );
}

export function Cercle({ centre, rayonM, fond, contour, epaisseur }: CercleProps) {
  return <Circle center={centre} radius={rayonM} fillColor={fond} strokeColor={contour} strokeWidth={epaisseur} />;
}
