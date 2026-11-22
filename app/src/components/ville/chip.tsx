import { StyleSheet } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { ThemedText } from '@/components/themed-text';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';
import { Coche } from './coche';

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
  const styles = useStyles(creerStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? (selectionne ? `${titre}, sélectionné` : titre)}
      accessibilityState={{ disabled: !actif, selected: selectionne }}
      style={[styles.chip, selectionne && styles.choisi, !actif && { opacity: 0.45 }]}>
      {selectionne ? <Coche /> : null}
      <ThemedText style={[styles.texte, selectionne && { fontWeight: '700' }]} maxFontSizeMultiplier={1.2}>
        {titre}
      </ThemedText>
    </Pressable>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 20, borderRadius: 30, borderWidth: 2, borderColor: P.border, backgroundColor: P.surface, justifyContent: 'center' },
  choisi: { borderColor: P.primary, backgroundColor: P.backgroundSelected },
  texte: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
