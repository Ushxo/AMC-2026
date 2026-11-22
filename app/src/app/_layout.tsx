import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(citoyen)" />
        <Stack.Screen name="ville" />
        <Stack.Screen name="essai-photo" />
        <Stack.Screen name="resultat" />
        <Stack.Screen name="frontend" />
        <Stack.Screen name="demo" />
      </Stack>
    </ThemeProvider>
  );
}
