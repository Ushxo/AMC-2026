import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { SelecteurTheme } from '@/components/ville/selecteur-theme';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSignalements } from '@/hooks/use-signalements';
import { useSource } from '@/hooks/use-source';
import { construireListe } from '@/lib/liste';
import { calculerResume } from '@/lib/resume';
import type { Categorie, Etat } from '@/types';

export default function AccueilVille() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { etat } = useSource();
  const { employe, deconnecter, demoHorsLigne: simule } = useSessionEmploye();
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
        <ScrollView
          contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={actualisation} onRefresh={actualiser} />}>
          <ThemedText type="subtitle" accessibilityRole="header">
            Mode Ville
          </ThemedText>
          <ThemedText themeColor="textSecondary">Connecté : {employe?.nom}</ThemedText>
          <BandeauSource etat={etat} simule={simule} />
          <SelecteurTheme />
          <View style={styles.actions}>
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
              {endroits.length === 0 ? (
                <Vide texte="Aucun signalement ne correspond à ces filtres." />
              ) : (
                endroits.map((e) => (
                  <LigneEndroit key={e.cle} endroit={e} etatsFiltres={etats} onPress={() => router.push(hrefEndroit(e))} />
                ))
              )}
            </>
          )}
          <Lien href="/" titre="Retour au mode citoyen" />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 14, maxWidth: 800, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
