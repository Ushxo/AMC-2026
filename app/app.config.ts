import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuration dynamique : reprend app.json tel quel et ajoute, seulement si les variables existent,
 * la clé Google Maps iOS (GOOGLE_MAPS_IOS_KEY) et l'identifiant de paquet (IOS_BUNDLE_IDENTIFIER).
 * Les valeurs viennent de app/.env.local : rien n'est écrit dans le dépôt.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const cleGoogle = process.env.GOOGLE_MAPS_IOS_KEY?.trim();
  const idPaquet = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
  const plugins = [...(config.plugins ?? [])];
  if (cleGoogle) plugins.push(['react-native-maps', { iosGoogleMapsApiKey: cleGoogle }]);
  return {
    ...config,
    name: config.name ?? 'Signalement MTL',
    slug: config.slug ?? 'signalement-mtl',
    ios: { ...config.ios, ...(idPaquet && !config.ios?.bundleIdentifier ? { bundleIdentifier: idPaquet } : {}) },
    plugins,
    // Lu par l'app : la build contient Google Maps seulement si la clé était là au moment de la build.
    extra: { ...config.extra, carteGoogle: !!cleGoogle },
  };
};
