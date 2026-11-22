import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

// Thème fixe aux couleurs de l'écran de test. Il ne dépend pas du mode
// clair/sombre de l'appareil : sinon, sur le web, le rendu serveur (clair)
// et le navigateur (parfois sombre) ne correspondent pas et React affiche
// une erreur d'hydratation.
const THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#F7F4EC' },
};

// Temporaire : l'app s'ouvre sur l'écran de test du ML (caméra → résultat).
// Les onglets du modèle Expo (components/app-tabs.tsx) seront remplacés par
// la navigation du vrai frontend.
export default function RootLayout() {
  return (
    <ThemeProvider value={THEME}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="resultat" />
      </Stack>
    </ThemeProvider>
  );
}
