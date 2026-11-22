import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { Filtres } from '@/components/ville/filtres';
import { hrefEndroit } from '@/components/ville/href-endroit';
import { LigneEndroit } from '@/components/ville/ligne-endroit';
import { Resume } from '@/components/ville/resume';
import { useSignalements } from '@/hooks/use-signalements';
import { construireListe } from '@/lib/liste';
import { calculerResume } from '@/lib/resume';
import type { Categorie, Etat } from '@/types';

function Separateur() {
  return <View style={styles.separateur} />;
}

type Props = {
  /** Contenu au-dessus de la liste (titre, actions...). */
  entete?: ReactNode;
  pied?: ReactNode;
  /** Montre le résumé par état et par catégorie au-dessus des filtres. */
  avecResume?: boolean;
  /** Espace réservé en bas (barre de navigation de la coquille). */
  espaceBas?: number;
};

/** Les endroits signalés, avec filtres : liste virtualisée (190 lignes ne sont pas rendues d'un coup), tirer pour actualiser. */
export function ListeAlertes({ entete, pied, avecResume = true, espaceBas = 0 }: Props) {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { signalements, rafraichir, chargement, erreur } = useSignalements();
  const [etats, setEtats] = useState<Etat[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [actualisation, setActualisation] = useState(false);

  const resume = useMemo(() => calculerResume(signalements), [signalements]);
  const endroits = useMemo(() => construireListe(signalements, { etats, categories }), [signalements, etats, categories]);

  async function actualiser() {
    setActualisation(true);
    await rafraichir();
    setActualisation(false);
  }

  return (
    <FlatList
      data={chargement || erreur ? [] : endroits}
      keyExtractor={(e) => e.cle}
      renderItem={({ item: e }) => <LigneEndroit endroit={e} etatsFiltres={etats} onPress={() => router.push(hrefEndroit(e))} />}
      ItemSeparatorComponent={Separateur}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 + espaceBas }]}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={actualiser} />}
      ListHeaderComponent={
        <View style={styles.entete}>
          {entete}
          {chargement ? (
            <Chargement texte="Chargement des signalements…" />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void actualiser()} />
          ) : (
            <>
              {avecResume ? <Resume resume={resume} /> : null}
              <Filtres etats={etats} categories={categories} onEtats={setEtats} onCategories={setCategories} />
              <ThemedText type="smallBold" accessibilityRole="header">
                Endroits signalés ({endroits.length})
              </ThemedText>
            </>
          )}
        </View>
      }
      ListEmptyComponent={!chargement && !erreur ? <Vide texte="Aucun signalement ne correspond à ces filtres." /> : undefined}
      ListFooterComponent={pied ? <View style={styles.pied}>{pied}</View> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 20, maxWidth: 800, width: '100%', alignSelf: 'center' },
  entete: { gap: 14, marginBottom: 14 },
  separateur: { height: 14 },
  pied: { marginTop: 14 },
});
