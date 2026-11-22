import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { Filtres } from '@/components/ville/filtres';
import { hrefEndroit } from '@/components/ville/href-endroit';
import { Lien } from '@/components/ville/lien';
import { LigneEndroit } from '@/components/ville/ligne-endroit';
import { Resume } from '@/components/ville/resume';
import { useMonEquipe } from '@/hooks/use-mon-equipe';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSignalements } from '@/hooks/use-signalements';
import { useSource } from '@/hooks/use-source';
import { construireListe } from '@/lib/liste';
import { calculerResume } from '@/lib/resume';
import type { Categorie, Etat } from '@/types';

function Separateur() {
  return <View style={styles.separateur} />;
}

export default function AccueilVille() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { employe, deconnecter, demoHorsLigne: simule } = useSessionEmploye();
  const { equipeId: monEquipe } = useMonEquipe();
  const { signalements, rafraichir, chargement, erreur } = useSignalements();
  const [etats, setEtats] = useState<Etat[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [actualisation, setActualisation] = useState(false);

  const resume = useMemo(() => calculerResume(signalements), [signalements]);
  const endroits = useMemo(
    () => construireListe(signalements, { etats, categories }),
    [signalements, etats, categories],
  );

  async function actualiser() {
    setActualisation(true);
    await rafraichir();
    setActualisation(false);
  }

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={['top']}>
        {/* Liste virtualisée : 190 lignes ne sont plus rendues d'un coup. */}
        <FlatList
          data={chargement || erreur ? [] : endroits}
          keyExtractor={(e) => e.cle}
          renderItem={({ item: e }) => (
            <LigneEndroit endroit={e} etatsFiltres={etats} onPress={() => router.push(hrefEndroit(e))} />
          )}
          ItemSeparatorComponent={Separateur}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={actualisation} onRefresh={actualiser} />}
          ListHeaderComponent={
            <View style={styles.entete}>
              <ThemedText type="subtitle" accessibilityRole="header">
                Mode Ville
              </ThemedText>
              <ThemedText themeColor="textSecondary">Connecté : {employe?.nom}</ThemedText>
              <BandeauSource etat={etat} simule={simule} />
              <View style={styles.actions}>
                {monEquipe ? (
                  <Bouton
                    titre="Ma tournée"
                    pleineLargeur
                    onPress={() => router.push({ pathname: '/ville/trajet/[equipe]', params: { equipe: monEquipe } })}
                  />
                ) : null}
                <Bouton titre="Tournées des équipes" pleineLargeur onPress={() => router.push('/ville/tournees')} />
                <Bouton titre="Équipes" variante="discret" onPress={() => router.push('/ville/equipes')} />
                <Bouton titre="Voir la carte" variante="discret" onPress={() => router.push('/ville/carte')} />
                <Bouton titre="Se déconnecter" variante="discret" onPress={() => void deconnecter()} />
              </View>
              {chargement ? (
                <Chargement texte="Chargement des signalements…" />
              ) : erreur ? (
                <Erreur message={erreur} onReessayer={() => void actualiser()} />
              ) : (
                <>
                  <Resume resume={resume} />
                  <Filtres etats={etats} categories={categories} onEtats={setEtats} onCategories={setCategories} />
                  <ThemedText type="smallBold" accessibilityRole="header">
                    Endroits signalés ({endroits.length})
                  </ThemedText>
                </>
              )}
            </View>
          }
          ListEmptyComponent={
            !chargement && !erreur ? <Vide texte="Aucun signalement ne correspond à ces filtres." /> : undefined
          }
          ListFooterComponent={
            <View style={styles.pied}>
              <Lien href="/" titre="Retour au mode citoyen" />
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, maxWidth: 800, width: '100%', alignSelf: 'center' },
  entete: { gap: 14, marginBottom: 14 },
  separateur: { height: 14 },
  pied: { marginTop: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
