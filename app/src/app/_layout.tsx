// Une graisse par import : seules les cinq graisses utilisées sont embarquées dans l'app.
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { definirPolicesChargees } from '@/components/texte';

// L'écran de démarrage reste affiché le temps de charger les polices. Un refus ne doit rien casser.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Écran de secours pour toute l'app : une erreur d'affichage ne ferme jamais l'app.
export { ErrorBoundary } from '@/components/ville/erreur-ecran';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Les polices sont chargées ici pour tous les écrans, même ouverts par un lien direct.
  // Si le chargement échoue, l'app garde la police du système.
  const [polices, erreurPolices] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  definirPolicesChargees(polices && !erreurPolices);
  if (!polices && !erreurPolices) return null;
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(citoyen)" />
        <Stack.Screen name="connexion" />
        <Stack.Screen name="ville" />
      </Stack>
    </ThemeProvider>
  );
}
