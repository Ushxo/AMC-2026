import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Bouton } from '@/components/ville/bouton';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteGravite, EtiquetteNeutre } from '@/components/ville/etiquette';
import { CIBLE_MIN } from '@/components/ville/style';
import { useSignalements } from '@/hooks/use-signalements';
import { useTheme } from '@/hooks/use-theme';
import { formaterDate } from '@/lib/format';
import { regrouper } from '@/lib/gravite';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT } from '@/types';

/** Liste des signalements d'un même endroit. */
export default function Endroit() {
  const { bottom } = useSafeAreaInsets();
  const { cle } = useLocalSearchParams<{ cle: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { signalements, chargement, erreur, rafraichir } = useSignalements();
  const endroit = useMemo(() => regrouper(signalements).find((e) => e.cle === cle), [signalements, cle]);
  const liste = useMemo(
    () => [...(endroit?.signalements ?? [])].sort((a, b) => b.cree_le.localeCompare(a.cree_le)),
    [endroit],
  );

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
          {chargement ? (
            <Chargement />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : !endroit ? (
            <Vide texte="Cet endroit n'a plus de signalement." />
          ) : (
            <>
              <View style={styles.entete}>
                <EtiquetteGravite gravite={endroit.gravite_affichee} />
                <ThemedText type="smallBold">
                  {endroit.nombre} signalement{endroit.nombre > 1 ? 's' : ''} ouvert{endroit.nombre > 1 ? 's' : ''}
                </ThemedText>
              </View>
              {liste.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${LIBELLES_CATEGORIE[s.categorie]}, ${LIBELLES_ETAT[s.etat]}. Ouvrir la fiche.`}
                  onPress={() => router.push({ pathname: '/ville/signalement/[id]', params: { id: s.id } })}
                  style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText>{LIBELLES_CATEGORIE[s.categorie]}</ThemedText>
                  <View style={styles.pied}>
                    <EtiquetteNeutre texte={LIBELLES_ETAT[s.etat]} />
                    <EtiquetteNeutre texte={formaterDate(s.cree_le)} />
                    {s.exemple_demo ? <EtiquetteNeutre texte="Exemple de démo" /> : null}
                  </View>
                </Pressable>
              ))}
            </>
          )}
          <Bouton titre="Retour" variante="discret" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ligne: { minHeight: CIBLE_MIN, padding: 14, borderRadius: 14, gap: 4 },
  pied: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
