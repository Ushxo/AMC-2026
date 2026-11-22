import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/theme';

/** Bouton en pilule des maquettes : contour, fond sauge quand il est choisi. Le choix se dit aussi en texte (accessibilité). */
export function Chip({
  titre,
  selectionne,
  actif = true,
  onPress,
  libelleAccessible,
}: {
  titre: string;
  selectionne?: boolean;
  actif?: boolean;
  onPress: () => void;
  libelleAccessible?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? (selectionne ? `${titre}, sélectionné` : titre)}
      accessibilityState={{ disabled: !actif, selected: selectionne }}
      style={[styles.chip, selectionne && styles.choisi, !actif && { opacity: 0.45 }]}>
      <ThemedText style={[styles.texte, selectionne && { fontWeight: '700' }]} maxFontSizeMultiplier={1.2}>
        {selectionne ? `✓ ${titre}` : titre}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 52, paddingHorizontal: 18, borderRadius: 26, borderWidth: 2, borderColor: '#C9CFBD', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  choisi: { borderColor: Palette.primary, backgroundColor: Palette.backgroundSelected },
  texte: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
