import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Text as TexteSvg } from 'react-native-svg';

import { COULEUR_ACCENT, COULEUR_REPERE, couleurSigne, LISERE_CLAIR, LISERE_SOMBRE } from './style';

/** normal = à faire ; choisi = sélectionné (coche) ; attenue = non sélectionné ; prochain = prochain arrêt (grand) ; fait = arrêt fait (coche, gris). */
export type EtatRepere = 'normal' | 'choisi' | 'attenue' | 'prochain' | 'fait' | 'groupe';

/** Sélection d'un groupe de repères : tous, certains (tiret) ou aucun. */
export type MarqueSelection = 'coche' | 'tiret' | 'aucune';

// Dessin du repère : viewBox 0 0 64 84, pointe en (32, 75). Pour le remplacer, coller ici les attributs `d`.
const TRACE_CORPS = 'M32 3C16.5 3 6 14.5 6 29c0 16 15.5 32 26 46 10.5-14 26-30 26-46C58 14.5 47.5 3 32 3Z';
const TRACE_GRILLE = 'M23 18h18M19 24h26M18 30h28M20 36h24M23 42h18';
const TRACE_COCHE = 'M20 30l9 10 16-20';
const POINTE = { x: 32, y: 75 };
const VUE = { largeur: 64, hauteur: 84 };
const MARGE = 6; // zone de toucher transparente autour du dessin

const TAILLES: Record<EtatRepere, { largeur: number; hauteur: number }> = {
  normal: { largeur: 24, hauteur: 32 },
  choisi: { largeur: 24, hauteur: 32 },
  attenue: { largeur: 24, hauteur: 32 },
  fait: { largeur: 24, hauteur: 32 },
  prochain: { largeur: 32, hauteur: 42 },
  groupe: { largeur: 30, hauteur: 40 },
};

/**
 * Où poser le repère pour que sa POINTE tombe sur la position géographique :
 * `ancre` (Google, proportion de l'image) et `decalage` (Apple, centerOffset en points).
 */
export function geometrieRepere(etat: EtatRepere) {
  const { largeur, hauteur } = TAILLES[etat];
  const zoneL = largeur + 2 * MARGE;
  const zoneH = hauteur + 2 * MARGE;
  const pointeY = MARGE + (hauteur * POINTE.y) / VUE.hauteur;
  return {
    zoneL,
    zoneH,
    ancre: { x: 0.5, y: pointeY / zoneH },
    decalage: { x: 0, y: -(pointeY - zoneH / 2) },
  };
}

/** Taille du numéro dans le dessin de 64 pt de large : lisible jusqu'à trois chiffres. */
export function taillePolice(n: number): number {
  return n > 99 ? 20 : n > 9 ? 27 : 32;
}

type Props = {
  /** Couleur de gravité (ou d'équipe), prise dans les jetons. */
  couleur: string;
  etat?: EtatRepere;
  /** Numéro d'arrêt écrit à la place de la grille (la coche reste pour « fait »). */
  numero?: number;
  /** Groupe : petit point rouge quand il contient un endroit élevé mais que sa moyenne n'est pas rouge. */
  pointEleve?: boolean;
  /** Groupe de la carte de sélection : tous les endroits (coche), certains (tiret). */
  marque?: MarqueSelection;
};

/**
 * Repère de bouche d'égout : une goutte avec une grille. La forme dit l'état, pas seulement la couleur :
 * grille = à faire, coche = sélectionné ou fait, grand avec halo bleu = prochain arrêt, atténué = non sélectionné.
 */
export function RepereEgout({ couleur, etat = 'normal', numero, pointEleve, marque }: Props) {
  const { largeur, hauteur } = TAILLES[etat];
  const g = geometrieRepere(etat);
  const coche = etat === 'choisi' || etat === 'fait';
  return (
    <View
      testID="repere-egout"
      style={[styles.zone, { width: g.zoneL, height: g.zoneH }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={largeur} height={hauteur} viewBox={`0 0 ${VUE.largeur} ${VUE.hauteur}`} opacity={etat === 'attenue' ? 0.5 : 1}>
        <Ellipse cx={32} cy={73} rx={23} ry={9} fill={couleur} opacity={0.18} />
        {etat === 'prochain' ? (
          <Path d={TRACE_CORPS} fill="none" stroke={COULEUR_ACCENT} strokeWidth={10} strokeLinejoin="round" />
        ) : null}
        <Path d={TRACE_CORPS} fill={couleur} stroke={LISERE_CLAIR} strokeWidth={3} strokeLinejoin="round" />
        {numero !== undefined && !coche ? (
          <TexteSvg
            x={32}
            y={29 + taillePolice(numero) * 0.36}
            fontSize={taillePolice(numero)}
            fontWeight="700"
            fill={couleurSigne(couleur)}
            textAnchor="middle">
            {String(numero)}
          </TexteSvg>
        ) : (
        <Path
          d={coche ? TRACE_COCHE : TRACE_GRILLE}
          fill="none"
          stroke={couleurSigne(couleur)}
          strokeWidth={coche ? 5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        )}
        {pointEleve ? <Circle cx={52} cy={13} r={9} fill={COULEUR_REPERE.elevee} stroke={LISERE_CLAIR} strokeWidth={3} /> : null}
        {marque === 'coche' || marque === 'tiret' ? (
          <>
            <Circle cx={12} cy={13} r={10} fill={LISERE_CLAIR} stroke={LISERE_SOMBRE} strokeWidth={1.5} />
            <Path d={marque === 'coche' ? 'M7 13l4 4 7-8' : 'M7 13h10'} fill="none" stroke={LISERE_SOMBRE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', justifyContent: 'center' },
});
