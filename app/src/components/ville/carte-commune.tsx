import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, UrlTile, type MapViewProps } from 'react-native-maps';
import type { Ref } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { envCarte, lireFondCarte, lireReglagesTuiles } from '@/lib/carte-reglages';

const DANS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// Vrai seulement dans une build native faite avec la clé Google (noté dans la configuration au moment de la build).
const GOOGLE_INSTALLE = Constants.expoConfig?.extra?.carteGoogle === true;

type Props = MapViewProps & { ref?: Ref<MapView> };

/**
 * Carte commune à tout l'app : fond sobre sans réseau tiers (Plans en style « atténué », sans lieux d'intérêt,
 * sans bâtiments ni circulation), clair ou sombre selon le thème. Les tuiles personnalisées restent coupées
 * tant qu'elles ne sont pas validées ; si on les active, l'attribution s'affiche sous la carte.
 */
export function CarteCommune({ children, style, ...reste }: Props) {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const fond = lireFondCarte(envCarte(), { dansExpoGo: DANS_EXPO_GO, googleInstalle: GOOGLE_INSTALLE, theme });
  // Avec Google, le style vient de l'identifiant de carte (console Google) : pas de tuiles par-dessus.
  const tuiles = fond.google ? { actif: false, modele: '', attribution: '' } : lireReglagesTuiles(envCarte());
  return (
    <View style={[styles.cadre, style]}>
      {/* googleMapId n'est lu qu'à la création de la carte native : on la recrée si le thème ou l'identifiant change. */}
      <MapView
        key={fond.google ? `google-${theme}-${fond.idCarte ?? 'defaut'}` : 'apple'}
        {...(fond.google
          ? { provider: PROVIDER_GOOGLE, googleMapId: fond.idCarte }
          : { mapType: 'mutedStandard' as const, userInterfaceStyle: theme })}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        {...reste}
        style={styles.carte}>
        {tuiles.actif ? <UrlTile urlTemplate={tuiles.modele} maximumZ={19} flipY={false} /> : null}
        {children}
      </MapView>
      {tuiles.actif ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {tuiles.attribution}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { overflow: 'hidden', borderRadius: 14 },
  carte: { flex: 1 },
  attribution: { position: 'absolute', right: 8, bottom: 4 },
});
