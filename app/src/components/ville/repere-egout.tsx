import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { COULEUR_ACCENT, LISERE_CLAIR } from './style';

/** normal = à faire ; choisi = sélectionné (coche) ; attenue = non sélectionné ; prochain = prochain arrêt (grand) ; fait = arrêt fait (coche, gris). */
export type EtatRepere = 'normal' | 'choisi' | 'attenue' | 'prochain' | 'fait';

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

type Props = {
  /** Couleur de gravité (ou d'équipe), prise dans les jetons. */
  couleur: string;
  etat?: EtatRepere;
};

/**
 * Repère de bouche d'égout : une goutte avec une grille. La forme dit l'état, pas seulement la couleur :
 * grille = à faire, coche = sélectionné ou fait, grand avec halo bleu = prochain arrêt, atténué = non sélectionné.
 */
export function RepereEgout({ couleur, etat = 'normal' }: Props) {
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
        <Path
          d={coche ? TRACE_COCHE : TRACE_GRILLE}
          fill="none"
          stroke={LISERE_CLAIR}
          strokeWidth={coche ? 5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', justifyContent: 'center' },
});
