import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Bouton } from '@/components/ville/bouton';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteGravite, EtiquetteNeutre } from '@/components/ville/etiquette';
import { usePassage } from '@/hooks/use-passage';
import { useSignalements } from '@/hooks/use-signalements';
import { formaterDate } from '@/lib/format';
import { MESSAGE_RESULTAT_PRECALCULE, messageHeureEstimee } from '@/lib/messages';
import { LIBELLES_CATEGORIE, LIBELLES_SUIVI, type EtapeSuivi } from '@/types';

const PARCOURS: EtapeSuivi[] = ['recu', 'planifie', 'pris_en_charge', 'regle'];

export default function SuiviSignalement() {
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { suivi, chargement, erreur } = usePassage(id);
  const { signalements, rafraichir } = useSignalements();
  const signalement = useMemo(() => signalements.find((s) => s.id === id), [signalements, id]);
  const rang = PARCOURS.indexOf(suivi.etape);

  return (
    <ThemedView style={styles.fond}>
      <Stack.Screen options={{ title: 'Suivi du signalement' }} />
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
          {chargement ? (
            <Chargement />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : !signalement ? (
            <Vide texte="Ce signalement est introuvable." />
          ) : (
            <>
              <ThemedText type="subtitle" accessibilityRole="header">
                {LIBELLES_CATEGORIE[signalement.categorie]}
              </ThemedText>
              <View style={styles.rangee}>
                <EtiquetteGravite gravite={signalement.gravite} />
                <EtiquetteNeutre texte={`Signalé le ${formaterDate(signalement.cree_le)}`} />
              </View>

              <ThemedText type="smallBold" accessibilityRole="header">
                Où en est votre signalement
              </ThemedText>
              {suivi.etape === 'rejete' ? (
                <ThemedText accessibilityRole="alert">{LIBELLES_SUIVI.rejete}</ThemedText>
              ) : (
                PARCOURS.map((e, i) => (
                  <ThemedText
                    key={e}
                    accessibilityLabel={`${LIBELLES_SUIVI[e]}${i === rang ? ', étape actuelle' : i < rang ? ', terminée' : ', à venir'}`}
                    type={i === rang ? 'smallBold' : 'small'}
                    themeColor={i > rang ? 'textSecondary' : 'text'}>
                    {i < rang ? '✓ ' : i === rang ? '● ' : '○ '}
                    {LIBELLES_SUIVI[e]}
                  </ThemedText>
                ))
              )}

              {suivi.etape === 'planifie' && suivi.heure_estimee ? (
                <>
                  <ThemedText>{messageHeureEstimee(suivi.heure_estimee)}</ThemedText>
                  {suivi.precalcule ? <EtiquetteNeutre texte={MESSAGE_RESULTAT_PRECALCULE} /> : null}
                </>
              ) : suivi.etape === 'recu' ? (
                <ThemedText themeColor="textSecondary">Pas encore planifié.</ThemedText>
              ) : null}
              {signalement.en_attente ? (
                <ThemedText themeColor="textSecondary">Ce signalement sera envoyé au retour du réseau.</ThemedText>
              ) : null}
            </>
          )}
          <Bouton titre="Retour à la carte" variante="discret" onPress={() => router.replace('/')} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
