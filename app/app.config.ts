import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withPodfile } from 'expo/config-plugins';

// Avec une clé dans ios.config, Expo ajoute au Podfile un ancien module de carte Google qui n'existe plus
// dans react-native-maps : on retire ce bloc quand la navigation est active.
function sansAncienModuleCarte(config: ExpoConfig): ExpoConfig {
  return withPodfile(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /# @generated begin react-native-maps[\s\S]*?# @generated end react-native-maps\n?/,
      '',
    );
    return mod;
  });
}

/**
 * Configuration dynamique : reprend app.json tel quel et ajoute, seulement si les variables existent,
 * la clé Google Maps iOS (GOOGLE_MAPS_IOS_KEY) et l'identifiant de paquet (IOS_BUNDLE_IDENTIFIER).
 * Les valeurs viennent de app/.env.local : rien n'est écrit dans le dépôt.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const cleGoogle = process.env.GOOGLE_MAPS_IOS_KEY?.trim();
  const idPaquet = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
  const plugins = [...(config.plugins ?? [])];
  // Navigation Google : seulement avec NAVIGATION_GOOGLE=1 et une clé (voir react-native.config.js).
  const navigation = process.env.NAVIGATION_GOOGLE === '1' && !!cleGoogle;
  // La navigation embarque sa propre version de Google Maps, incompatible avec celle de react-native-maps :
  // avec la navigation, les autres cartes restent sur Plans.
  const carteGoogle = !!cleGoogle && !navigation;
  if (carteGoogle) plugins.push(['react-native-maps', { iosGoogleMapsApiKey: cleGoogle }]);
  if (navigation) {
    plugins.push('@googlemaps/react-native-navigation-sdk');
    plugins.push('./plugins/images-reperes.js');
    // La navigation Google demande iOS 17 au minimum.
    plugins.push(['expo-build-properties', { ios: { deploymentTarget: '17.0', useFrameworks: 'static' } }]);
  }
  const resultat: ExpoConfig = {
    ...config,
    name: config.name ?? 'Priorix',
    slug: config.slug ?? 'signalement-mtl',
    ios: {
      ...config.ios,
      ...(idPaquet && !config.ios?.bundleIdentifier ? { bundleIdentifier: idPaquet } : {}),
      ...(navigation
        ? {
            config: { ...config.ios?.config, googleMapsApiKey: cleGoogle },
            // La navigation Google garde le guidage actif écran éteint : elle exige ces réglages.
            infoPlist: {
              ...config.ios?.infoPlist,
              UIBackgroundModes: ['location', 'audio'],
              // Sans langue déclarée, les textes de la navigation Google restent en anglais.
              // Français seulement : la navigation Google suit la langue de l'app, pas celle du téléphone.
              CFBundleLocalizations: ['fr'],
              CFBundleDevelopmentRegion: 'fr',
              NSLocationAlwaysAndWhenInUseUsageDescription:
                "Votre position sert à guider l'équipe vers ses arrêts pendant le trajet.",
              NSMotionUsageDescription: "Le mouvement de l'appareil rend le guidage plus précis.",
            },
          }
        : {}),
    },
    plugins,
    // Lu par l'app : la build contient Google Maps seulement si la clé était là au moment de la build.
    extra: { ...config.extra, carteGoogle, navigationGoogle: navigation },
  };
  return navigation ? sansAncienModuleCarte(resultat) : resultat;
};
