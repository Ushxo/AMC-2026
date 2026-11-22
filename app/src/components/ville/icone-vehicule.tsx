import Svg, { Path } from 'react-native-svg';

import { COULEUR_VEHICULE, LISERE_CLAIR, LISERE_SOMBRE } from './style';

// Véhicule vu de dessus, pointe vers le haut (nord). Pour le remplacer, changer les tracés ci-dessous (viewBox 40 x 40).
const TRACE_CORPS = 'M20 3c5 0 8 3 8 8v20c0 3-2 5-5 5H17c-3 0-5-2-5-5V11c0-5 3-8 8-8Z';
const TRACE_PARE_BRISE = 'M14.5 12.5c1.5-2.2 3.6-3.2 5.5-3.2s4 1 5.5 3.2l-1 5h-9Z';
const TRACE_FLECHE = 'M20 22l5 7h-10Z';

/** Icône du véhicule de l'équipe. Elle se tourne avec la propriété `rotation` du repère, pas ici. */
export function IconeVehicule({ taille = 36 }: { taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={TRACE_CORPS} fill={COULEUR_VEHICULE} stroke={LISERE_CLAIR} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d={TRACE_PARE_BRISE} fill={LISERE_CLAIR} opacity={0.9} />
      <Path d={TRACE_FLECHE} fill={LISERE_SOMBRE} opacity={0.55} />
    </Svg>
  );
}
