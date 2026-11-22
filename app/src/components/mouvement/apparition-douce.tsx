import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeOut, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { View } from 'react-native';

import { DUREE_BREVE_MS, DUREE_NORMALE_MS } from './reglages';

/** Élément qui apparaît (légère échelle et fondu) et disparaît (fondu) quand `visible` change : la coche d'un choix, une pastille. */
export function ApparitionDouce({ visible, children, style }: { visible: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduit = useReducedMotion();
  if (!visible) return null;
  if (reduit) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={ZoomIn.duration(DUREE_NORMALE_MS)} exiting={FadeOut.duration(DUREE_BREVE_MS)} style={style}>
      {children}
    </Animated.View>
  );
}
