import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { CIBLE_MIN } from './style';

type Props = {
  titre: string;
  onPress: () => void;
  variante?: 'plein' | 'discret';
  actif?: boolean;
  selectionne?: boolean;
  libelleAccessible?: string;
  /** Occupe toute la ligne : pour l'action principale d'un écran. */
  pleineLargeur?: boolean;
  /** Une action est en cours : indicateur d'activité dans le bouton, appui désactivé. */
  occupe?: boolean;
};

export function Bouton({
  titre,
  onPress,
  variante = 'plein',
  actif = true,
  selectionne,
  libelleAccessible,
  pleineLargeur,
  occupe,
}: Props) {
  const theme = useTheme();
  const plein = variante === 'plein';
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif || !!occupe}
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? (selectionne ? `${titre}, sélectionné` : titre)}
      accessibilityState={{ disabled: !actif || !!occupe, selected: selectionne, busy: !!occupe }}
      style={({ pressed }) => [
        styles.bouton,
        pleineLargeur ? styles.pleine : null,
        {
          backgroundColor: plein ? theme.primary : selectionne ? theme.backgroundSelected : theme.backgroundElement,
          opacity: !actif ? 0.45 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      <View style={styles.contenu}>
        {occupe ? <ActivityIndicator size="small" color={plein ? theme.onPrimary : undefined} /> : null}
        <ThemedText type="smallBold" style={plein ? { color: theme.onPrimary } : undefined}>
          {selectionne ? `✓ ${titre}` : titre}
        </ThemedText>
      </View>
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
  contenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
