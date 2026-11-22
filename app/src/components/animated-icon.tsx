import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

/** Pas d'animation d'ouverture : l'écran de démarrage fixe (logo de la marque) se retire dès que l'app est prête. */
export function AnimatedSplashOverlay() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}
