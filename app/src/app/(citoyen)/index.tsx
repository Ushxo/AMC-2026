import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Circle, Polygon } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COULEUR_AVIS, FOND_AVIS } from '@/components/citoyen-essai/style';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { CarteCommune } from '@/components/ville/carte-commune';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { Chargement, Erreur } from '@/components/ville/etat-ecran';
import { Lien } from '@/components/ville/lien';
import { SelecteurTheme } from '@/components/ville/selecteur-theme';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useCouches } from '@/hooks/use-couches';
import { useBouchesExistantes } from '@/hooks/use-bouches-existantes';
import { useEndroits } from '@/hooks/use-endroits';
import { useSource } from '@/hooks/use-source';
import { formaterNombre } from '@/lib/format';
import { chargerRegion } from '@/lib/officiel';
import { LIBELLES_GRAVITE, type Endroit } from '@/types';

function premierSignalement(e: Endroit): string {
  const ouvert = e.signalements.find((s) => s.etat === 'nouveau' || s.etat === 'pris_en_charge');
  return (ouvert ?? e.signalements[0]).id;
}

export default function CarteCitoyen() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { couches } = useCouches();
  const { endroits, chargement, erreur, rafraichir } = useEndroits();
  const region = useMemo(() => chargerRegion(), []);
  const visibles = useMemo(() => endroits.filter((e) => e.nombre > 0), [endroits]);
  const avis = couches.avisEau.features;
  const { bouches, surRegion } = useBouchesExistantes(endroits);

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
          <ThemedText type="subtitle" accessibilityRole="header">
            Signalement MTL
          </ThemedText>
          <BandeauSource etat={etat} />
          <View style={styles.rangee}>
            <Bouton titre="Signaler un problème" pleineLargeur onPress={() => router.push('/signaler')} />
          </View>

          {chargement ? (
            <Chargement texte="Chargement de la carte…" />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : (
            <CarteCommune style={styles.carte} initialRegion={region} onRegionChangeComplete={surRegion} accessibilityLabel="Carte des signalements et des avis d'eau">
              {avis.map((f) => {
                const g = f.geometry;
                if (!g) return null;
                if (g.type === 'Point') {
                  return (
                    <Circle
                      key={`a-${f.properties.id}`}
                      center={{ latitude: g.coordinates[1], longitude: g.coordinates[0] }}
                      radius={150}
                      strokeColor={COULEUR_AVIS}
                      fillColor={FOND_AVIS}
                    />
                  );
                }
                const anneaux = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
                return anneaux.map((poly, i) => (
                  <Polygon
                    key={`a-${f.properties.id}-${i}`}
                    coordinates={poly[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                    strokeColor={COULEUR_AVIS}
                    fillColor={FOND_AVIS}
                    strokeWidth={2}
                  />
                ));
              })}
              {bouches.map((b) => (
                <MarqueurEgout
                  key={`b-${b.id}`}
                  coordinate={b.position}
                  couleur={COULEUR_REPERE.existant}
                  zIndex={1}
                  accessibilityLabel="Bouche d'égout sans signalement actif"
                />
              ))}
              {visibles.map((e) => {
                const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
                return (
                  <MarqueurEgout
                    key={e.cle}
                    coordinate={e.position}
                    couleur={COULEUR_REPERE[e.gravite_affichee]}
                    zIndex={2}
                    title={`Gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                    description={nombre}
                    accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}. Voir le suivi.`}
                    onCalloutPress={() =>
                      router.push({ pathname: '/suivi/[id]', params: { id: premierSignalement(e) } })
                    }
                  />
                );
              })}
            </CarteCommune>
          )}

          <ThemedText type="small" themeColor="textSecondary">
            Les repères montrent les endroits signalés, avec leur gravité. Touchez un repère, puis sa bulle, pour suivre
            un signalement. Les zones bleues sont des avis d&apos;eau ({formaterNombre(avis.length, 'avis', 'avis')}).
          </ThemedText>
          <Lien href="/ville" titre="Mode Ville" />
          <SelecteurTheme />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carte: { height: 360, borderRadius: 14 },
});
