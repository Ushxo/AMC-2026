// Une graisse par import : seules les cinq graisses utilisées sont embarquées dans l'app.
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { definirPolicesChargees } from '@/components/texte';
import { installerGestionnaires } from '@/lib/trace';
import { useJetons } from '@/marque/utiliser';

// L'écran de démarrage reste affiché le temps de charger les polices. Un refus ne doit rien casser.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Écran de secours pour toute l'app : une erreur d'affichage ne ferme jamais l'app.
export { ErrorBoundary } from '@/components/ville/erreur-ecran';

// Une promesse rejetée sans traitement est tracée en développement et ne dérange jamais l'utilisateur.
installerGestionnaires();

export default function RootLayout() {
  // Le fond et les couleurs de la navigation viennent du thème de l'app, jamais du mode clair ou sombre
  // du téléphone : sinon un iPhone en mode sombre met un fond noir sous des écrans au thème clair.
  const jetons = useJetons();
  const themeNavigation = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: jetons.background,
      card: jetons.surface,
      text: jetons.text,
      border: jetons.border,
      primary: jetons.primary,
    },
  };
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
    <ThemeProvider value={themeNavigation}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(citoyen)" />
        <Stack.Screen name="connexion" />
        <Stack.Screen name="ville" />
      </Stack>
    </ThemeProvider>
  );
}
