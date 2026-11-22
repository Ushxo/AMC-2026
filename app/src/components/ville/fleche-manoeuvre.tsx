import Svg, { Circle, Path } from 'react-native-svg';

import type { IconeManoeuvre } from '@/lib/guidage';

import { COULEUR_ACCENT, LISERE_CLAIR } from './style';

// Flèches de manœuvre dans un cadre de 48 x 48. Pour les remplacer, changer les tracés ci-dessous.
const TRACES: Record<IconeManoeuvre, string> = {
  droit: 'M24 38V14M14 22l10-10 10 10',
  gauche: 'M34 38V24q0-8-8-8H14M22 8l-8 8 8 8',
  droite: 'M14 38V24q0-8 8-8h12M26 8l8 8-8 8',
  'leger-gauche': 'M30 38V26q0-6-5-10l-5-5M12 18v-8h8',
  'leger-droite': 'M18 38V26q0-6 5-10l5-5M36 18v-8h-8',
  'serre-gauche': 'M34 38V22L16 22M16 14l-8 8 8 8',
  'serre-droite': 'M14 38V22l18 0M32 14l8 8-8 8',
  'demi-tour': 'M32 38V18q0-8-8-8t-8 8v6M10 20l6 6 6-6',
  'rond-point': 'M24 40v-8M24 32a8 8 0 1 1 8-8M32 24l-4-5M32 24l5-4',
  arrivee: 'M16 38V10M16 10h18l-5 7 5 7H16',
};

/** Flèche de la prochaine manœuvre, dans un disque d'accent. Cachée des lecteurs d'écran : la phrase porte l'information. */
export function FlecheManoeuvre({ icone, taille = 56 }: { icone: IconeManoeuvre; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={24} cy={24} r={23} fill={COULEUR_ACCENT} />
      <Path d={TRACES[icone]} fill="none" stroke={LISERE_CLAIR} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
