import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/** Opacité d'une zone pressée : le changement se voit tout de suite (rendu immédiat, sans animation coûteuse). */
export const OPACITE_APPUI = 0.78;

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((etat: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Faux pour un fond qui ferme une feuille : pas de clignotement sur tout l'écran. */
  retour?: boolean;
};

/**
 * Pressable de l'app : un retour visible à chaque appui (opacité), comme le Bouton partagé. Même rendu avec « réduire les animations » :
 * le changement est instantané, il n'y a pas de mouvement.
 */
export function Appuyable({ style, retour = true, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [typeof style === 'function' ? style({ pressed }) : style, retour && pressed && !rest.disabled ? { opacity: OPACITE_APPUI } : null]}
    />
  );
}
