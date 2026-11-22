import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Carte, Repere, type CarteCommandes } from '@/components/carte';
import { AvisEau } from '@/components/ville/avis-eau';
import { ReperesEndroits } from '@/components/ville/reperes-endroits';
import { FicheZone } from '@/components/ville/fiche-zone';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { ListeEndroits } from '@/components/ville/liste-endroits';
import { ZonesSignalements } from '@/components/ville/zones-signalements';
import { Lien } from '@/components/ville/lien';
import { SelecteurCarte } from '@/components/ville/selecteur-carte';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useCouches } from '@/hooks/use-couches';
import { useZonesSignalements } from '@/hooks/use-zones-signalements';
import { useBouchesExistantes } from '@/hooks/use-bouches-existantes';
import { useRegroupement } from '@/hooks/use-regroupement';
import { useEndroits } from '@/hooks/use-endroits';
import { usePositionCarte } from '@/hooks/use-position-carte';
import { useSource } from '@/hooks/use-source';
import { formaterNombre } from '@/lib/format';
import { chargerRegion } from '@/lib/officiel';
import { zoneEn, type Zone } from '@/lib/zones';
import { dansQuartier, messagePositionCarte, RAYON_CITOYEN_M } from '@/lib/position-citoyen';
import { MESSAGE_ZONE_ESTIMEE } from '@/lib/messages';
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
  const { endroits, signalements, chargement, erreur, rafraichir } = useEndroits();
  const zones = useZonesSignalements(signalements);
  const [zoneChoisie, setZoneChoisie] = useState<Zone | null>(null);
  const region = useMemo(() => chargerRegion(), []);
  const visibles = useMemo(() => endroits.filter((e) => e.nombre > 0), [endroits]);
  const avis = couches.avisEau.features;
  const { bouches, surRegion } = useBouchesExistantes(endroits);
  const { regroupement, surRegion: surRegionGroupes, surTaille } = useRegroupement(visibles, region);
  const carte = useRef<CarteCommandes>(null);
  const { position: maPosition, statut: statutPosition, actualiser } = usePositionCarte();
  const dejaCentre = useRef(false);

  // À l'ouverture : la carte se centre sur le citoyen dès que sa position arrive, s'il est dans le quartier desservi.
  useEffect(() => {
    if (dejaCentre.current || chargement || erreur || !maPosition || !dansQuartier(maPosition, region)) return;
    if (!carte.current) return;
    dejaCentre.current = true;
    carte.current.surPosition(maPosition, RAYON_CITOYEN_M);
  }, [maPosition, chargement, erreur, region]);

  async function recentrer() {
    const p = maPosition ?? (await actualiser());
    if (p && dansQuartier(p, region)) carte.current?.surPosition(p, RAYON_CITOYEN_M);
  }
  const messagePosition = messagePositionCarte(statutPosition, maPosition, region);

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
          ) : visibles.length === 0 ? (
            <Vide texte="Aucun signalement ouvert dans ce quartier pour le moment." />
          ) : (
            <Carte
              style={styles.carte}
              commandes={carte}
              regionInitiale={region}
              positionUtilisateur={statutPosition === 'ok'}
              onTaille={surTaille}
              onRegionChangeComplete={(r) => {
                surRegion(r);
                surRegionGroupes(r);
              }}
              onPress={(c) => {
                const z = zoneEn(zones, c);
                if (z) setZoneChoisie(z);
              }}
              accessibilityLabel="Carte des signalements et des avis d'eau">
              <AvisEau avis={avis} />
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
                rendreEndroit={(e) => {
                  const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
                  return (
                    <Repere
                      key={e.cle}
                      id={`endroit-${e.cle}`}
                      position={e.position}
                      couleur={COULEUR_REPERE[e.gravite_affichee]}
                      zIndex={2}
                      titre={`Gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                      description={nombre}
                      accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}. Voir le suivi.`}
                      onBulle={() => router.push({ pathname: '/suivi/[id]', params: { id: premierSignalement(e) } })}
                    />
                  );
                }}
              />
            </Carte>
          )}

          <View style={styles.rangee}>
            <Bouton titre="Ma position" variante="discret" onPress={() => void recentrer()} />
          </View>
          {messagePosition ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
              {messagePosition}
            </ThemedText>
          ) : null}
          <ListeEndroits endroits={visibles} onOuvrir={(e) => router.push({ pathname: '/suivi/[id]', params: { id: premierSignalement(e) } })} />
          <SelecteurCarte />
          <ThemedText type="small" themeColor="textSecondary">
            Les repères montrent les endroits signalés, avec leur gravité. Touchez un repère, puis sa bulle, pour suivre
            un signalement. Les zones bleues sont des avis d&apos;eau ({formaterNombre(avis.length, 'avis', 'avis')}).
          </ThemedText>
          {zones.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {MESSAGE_ZONE_ESTIMEE}. Touchez une zone pour voir ses signalements.
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            Regards d&apos;égout : Données ouvertes de la Ville de Montréal, CC BY 4.0.
          </ThemedText>
          <Lien href="/ville" titre="Mode Ville" />
        </ScrollView>
        <FicheZone
          zone={zoneChoisie}
          signalements={signalements}
          onFermer={() => setZoneChoisie(null)}
          onOuvrir={(id) => {
            setZoneChoisie(null);
            router.push({ pathname: '/suivi/[id]', params: { id } });
          }}
        />
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
