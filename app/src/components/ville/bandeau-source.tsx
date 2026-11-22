import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MESSAGE_DEMO_SIMULEE, MESSAGE_REPLI } from '@/lib/messages';
import type { EtatSource } from '@/types';

/** Message discret : copie locale (hors ligne) ou démonstration simulée. */
export function BandeauSource({ etat, simule }: { etat: EtatSource; simule?: boolean }) {
  const theme = useTheme();
  if (etat === 'en_ligne' && !simule) return null;
  return (
    <View style={[styles.bandeau, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="alert">
      <ThemedText type="small">{simule ? MESSAGE_DEMO_SIMULEE : MESSAGE_REPLI}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { padding: 12, borderRadius: 10 },
});
