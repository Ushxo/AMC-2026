import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { Bouton } from './bouton';

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centre} accessibilityRole="progressbar" accessibilityLabel={texte}>
      <ActivityIndicator size="large" color={theme.primary} />
      <ThemedText themeColor="textSecondary">{texte}</ThemedText>
    </View>
  );
}

export function Erreur({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <View style={styles.centre} accessibilityRole="alert">
      <ThemedText>{message}</ThemedText>
      {onReessayer ? <Bouton titre="Réessayer" onPress={onReessayer} /> : null}
    </View>
  );
}

export function Vide({ texte }: { texte: string }) {
  return (
    <View style={styles.centre}>
      <ThemedText themeColor="textSecondary">{texte}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { padding: 24, gap: 12, alignItems: 'center', justifyContent: 'center' },
});
