import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Carte, Repere, type CarteCommandes } from '@/components/carte';
import { FicheZone } from '@/components/ville/fiche-zone';
import { ReperesEndroits } from '@/components/ville/reperes-endroits';
import { ZonesSignalements } from '@/components/ville/zones-signalements';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { hrefEndroit } from '@/components/ville/href-endroit';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useBouchesExistantes } from '@/hooks/use-bouches-existantes';
import { useRegroupement } from '@/hooks/use-regroupement';
import { useEndroits } from '@/hooks/use-endroits';
import { useZonesSignalements } from '@/hooks/use-zones-signalements';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { chargerRegion } from '@/lib/officiel';
import { formaterNombre } from '@/lib/format';
import { MESSAGE_ZONE_ESTIMEE } from '@/lib/messages';
import { zoneEn, type Zone } from '@/lib/zones';
import { LIBELLES_GRAVITE } from '@/types';

export default function CarteVille() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { demoHorsLigne: simule } = useSessionEmploye();
  const { endroits, signalements, chargement, erreur, rafraichir } = useEndroits();
  const zones = useZonesSignalements(signalements);
  const [zoneChoisie, setZoneChoisie] = useState<Zone | null>(null);
  const region = useMemo(() => chargerRegion(), []);
  const actifs = useMemo(() => endroits.filter((e) => e.nombre > 0), [endroits]);
  const { bouches, surRegion } = useBouchesExistantes(endroits);
  const { regroupement, surRegion: surRegionGroupes, surTaille } = useRegroupement(actifs, region, 600);
  const carte = useRef<CarteCommandes>(null);

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
          <Carte
            style={styles.carte}
            commandes={carte}
            regionInitiale={region}
            onTaille={surTaille}
            onRegionChangeComplete={(r) => {
              surRegion(r);
              surRegionGroupes(r);
            }}
            onPress={(c) => {
              const z = zoneEn(zones, c);
              if (z) setZoneChoisie(z);
            }}
            accessibilityLabel="Carte des endroits signalés">
            <ZonesSignalements zones={zones} onChoisir={setZoneChoisie} />
            {bouches.map((b) => (
              <Repere
                key={`b-${b.id}`}
                id={`regard-${b.id}`}
                position={b.position}
                couleur={COULEUR_REPERE.existant}
                zIndex={1}
                accessibilityLabel={`Regard d'égout, sans signalement${b.adresse ? `, ${b.adresse}` : ''}`}
              />
            ))}
            <ReperesEndroits
              regroupement={regroupement}
              onZoomer={(points) => carte.current?.zoomer(points)}
              rendreEndroit={(e) => (
                <Repere
                  key={e.cle}
                  id={`endroit-${e.cle}`}
                  position={e.position}
                  couleur={COULEUR_REPERE[e.gravite_affichee]}
                  zIndex={2}
                  titre={`Gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                  description={formaterNombre(e.nombre, 'signalement', 'signalements')}
                  onPress={() => router.push(hrefEndroit(e))}
                  accessibilityLabel={`${formaterNombre(e.nombre, 'signalement', 'signalements')}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                />
              )}
            />
          </Carte>
        )}
        <View style={[styles.bas, { paddingBottom: 16 + bottom }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Touchez un repère pour ouvrir ses signalements.{zones.length > 0 ? ` ${MESSAGE_ZONE_ESTIMEE}.` : ''}
          </ThemedText>
          <Bouton titre="Retour à la liste" variante="discret" onPress={() => router.back()} />
        </View>
        <FicheZone
          zone={zoneChoisie}
          signalements={signalements}
          onFermer={() => setZoneChoisie(null)}
          onOuvrir={(id) => {
            setZoneChoisie(null);
            router.push({ pathname: '/ville/signalement/[id]', params: { id } });
          }}
        />
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
