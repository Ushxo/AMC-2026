import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { CIBLE_MIN, COULEUR_ACCENT } from './style';

type Props = {
  titre: string;
  onPress: () => void;
  variante?: 'plein' | 'discret';
  actif?: boolean;
  selectionne?: boolean;
  libelleAccessible?: string;
  /** Occupe toute la ligne : pour l'action principale d'un écran. */
  pleineLargeur?: boolean;
};

export function Bouton({
  titre,
  onPress,
  variante = 'plein',
  actif = true,
  selectionne,
  libelleAccessible,
  pleineLargeur,
}: Props) {
  const theme = useTheme();
  const plein = variante === 'plein';
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? (selectionne ? `${titre}, sélectionné` : titre)}
      accessibilityState={{ disabled: !actif, selected: selectionne }}
      style={({ pressed }) => [
        styles.bouton,
        pleineLargeur ? styles.pleine : null,
        {
          backgroundColor: plein ? COULEUR_ACCENT : selectionne ? theme.backgroundSelected : theme.backgroundElement,
          opacity: !actif ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={plein ? styles.texteBlanc : undefined}>
        {selectionne ? `✓ ${titre}` : titre}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: {
    minHeight: CIBLE_MIN,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pleine: { width: '100%' },
  texteBlanc: { color: '#ffffff' },
});
