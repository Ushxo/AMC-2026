import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { Bouton } from './bouton';

export const MESSAGE_PROBLEME = 'Un problème est survenu.';

/**
 * Écran de secours d'Expo Router : une erreur de rendu affiche ce message et un bouton « Réessayer »
 * au lieu d'un écran rouge. Le détail de l'erreur n'est jamais montré.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  // En développement seulement : le détail va dans la console (terminal de Metro), jamais à l'écran.
  useEffect(() => {
    if (__DEV__) console.error('Erreur de rendu :', error?.message, error?.stack);
  }, [error]);
  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond}>
        <View style={styles.contenu} accessibilityRole="alert">
          <ThemedText type="subtitle" accessibilityRole="header">
            {MESSAGE_PROBLEME}
          </ThemedText>
          <ThemedText themeColor="textSecondary">Vous pouvez réessayer. Vos données ne sont pas perdues.</ThemedText>
          <Bouton titre="Réessayer" onPress={() => void retry()} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { flex: 1, padding: 24, gap: 16, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
});
