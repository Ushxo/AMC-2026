import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { CarteCommune } from '@/components/ville/carte-commune';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { hrefEndroit } from '@/components/ville/href-endroit';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useBouchesExistantes } from '@/hooks/use-bouches-existantes';
import { useEndroits } from '@/hooks/use-endroits';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { chargerRegion } from '@/lib/officiel';
import { formaterNombre } from '@/lib/format';
import { LIBELLES_GRAVITE } from '@/types';

export default function CarteVille() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { demoHorsLigne: simule } = useSessionEmploye();
  const { endroits, chargement, erreur, rafraichir } = useEndroits();
  const region = useMemo(() => chargerRegion(), []);
  const actifs = useMemo(() => endroits.filter((e) => e.nombre > 0), [endroits]);
  const { bouches, surRegion } = useBouchesExistantes(endroits);

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <View style={styles.haut}>
          <BandeauSource etat={etat} simule={simule} />
        </View>
        {chargement ? (
          <Chargement texte="Chargement de la carte…" />
        ) : erreur ? (
          <Erreur message={erreur} onReessayer={() => void rafraichir()} />
        ) : actifs.length === 0 ? (
          <Vide texte="Aucun endroit signalé pour le moment." />
        ) : (
          <CarteCommune style={styles.carte} initialRegion={region} onRegionChangeComplete={surRegion} accessibilityLabel="Carte des endroits signalés">
            {bouches.map((b) => (
              <MarqueurEgout
                key={`b-${b.id}`}
                coordinate={b.position}
                couleur={COULEUR_REPERE.existant}
                zIndex={1}
                accessibilityLabel="Bouche d'égout sans signalement actif"
              />
            ))}
            {actifs.map((e) => (
              <MarqueurEgout
                key={e.cle}
                coordinate={e.position}
                couleur={COULEUR_REPERE[e.gravite_affichee]}
                zIndex={2}
                title={`Gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                description={formaterNombre(e.nombre, 'signalement', 'signalements')}
                onPress={() => router.push(hrefEndroit(e))}
                accessibilityLabel={`${formaterNombre(e.nombre, 'signalement', 'signalements')}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
              />
            ))}
          </CarteCommune>
        )}
        <View style={[styles.bas, { paddingBottom: 16 + bottom }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Touchez un repère pour ouvrir ses signalements.
          </ThemedText>
          <Bouton titre="Retour à la liste" variante="discret" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  haut: { paddingHorizontal: 16, paddingTop: 8 },
  carte: { flex: 1, marginTop: 8 },
  bas: { padding: 16, gap: 8 },
});
