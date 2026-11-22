import type { ReactNode, Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { EtatRepere, MarqueSelection } from '@/components/ville/repere-egout';
import type { Region } from '@/lib/config';
import type { Coordonnees } from '@/types';

/** Commandes de caméra, les mêmes avec les deux fournisseurs. */
export type CarteCommandes = {
  /** Cadre tous ces points (vue d'ensemble). */
  cadrer: (points: Coordonnees[]) => void;
  /** Suit un véhicule : caméra centrée, inclinée, tournée selon le cap. */
  suivre: (position: Coordonnees, cap: number | null) => void;
  /** Recentre la carte sur un point, sans changer le zoom. */
  centrer: (position: Coordonnees) => void;
  /** Zoome sur l'emprise de ces points (par exemple un groupe de repères). */
  zoomer: (points: Coordonnees[]) => void;
  /** Centre la carte sur un point, avec ce rayon visible autour (en mètres). */
  surPosition: (position: Coordonnees, rayonM: number) => void;
};

export type CarteProps = {
  style?: StyleProp<ViewStyle>;
  regionInitiale: Region;
  /** Toucher de la carte (hors repère). */
  onPress?: (c: Coordonnees) => void;
  /** Fin d'un déplacement ou d'un zoom. */
  onRegionChangeComplete?: (r: Region) => void;
  /** L'utilisateur déplace la carte avec le doigt. */
  onDeplacement?: () => void;
  accessibilityLabel?: string;
  /** Montre le point de position de l'appareil (la permission doit être accordée). */
  positionUtilisateur?: boolean;
  /** Taille de la carte en points, à chaque mesure. */
  onTaille?: (t: { largeur: number; hauteur: number }) => void;
  children?: ReactNode;
  commandes?: Ref<CarteCommandes>;
};

export type RepereProps = {
  /** Identifiant unique sur la carte. */
  id: string;
  position: Coordonnees;
  couleur: string;
  etat?: EtatRepere;
  numero?: number;
  titre?: string;
  description?: string;
  /** Toucher du repère. */
  onPress?: () => void;
  /** Toucher de sa bulle d'information. */
  onBulle?: () => void;
  zIndex?: number;
  accessibilityLabel?: string;
};

export type RepereGroupeProps = {
  id: string;
  position: Coordonnees;
  couleur: string;
  nombre: number;
  pointEleve?: boolean;
  marque?: MarqueSelection;
  /** Groupe d'éléments d'information seulement (avis d'eau, chantiers, zones) : repère bleu neutre, `nombre` les compte. */
  information?: boolean;
  /** Le groupe de signalements absorbe aussi au moins un avis d'eau officiel : petite marque bleu pétrole. */
  pointAvis?: boolean;
  onPress?: () => void;
  zIndex?: number;
  accessibilityLabel?: string;
};

export type VehiculeProps = {
  id: string;
  position: Coordonnees;
  cap: number | null;
  titre?: string;
  description?: string;
  accessibilityLabel?: string;
};

export type TraceProps = { id: string; points: Coordonnees[]; couleur: string; epaisseur: number; /** Rend le tracé touchable. */ onPress?: () => void };

export type ZoneProps = {
  id: string;
  exterieur: Coordonnees[];
  trous?: Coordonnees[][];
  fond: string;
  contour: string;
  epaisseur: number;
  onPress?: () => void;
};

export type CercleProps = {
  id: string;
  centre: Coordonnees;
  rayonM: number;
  fond: string;
  contour: string;
  epaisseur: number;
  onPress?: () => void;
};

/** Petit repère d'information posé au milieu d'un avis, d'une bande d'eau, d'un chantier ou d'une zone inondable (touchable). */
export type RepereInfoProps = {
  id: string;
  position: Coordonnees;
  genre: 'ebullition' | 'coupure' | 'bande' | 'chantier' | 'zone';
  onPress?: () => void;
  accessibilityLabel?: string;
};
