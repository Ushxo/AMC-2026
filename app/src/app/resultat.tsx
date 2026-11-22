// ÉCRAN DE TEST du modèle ML (temporaire).
// Page 2 : envoie la photo au serveur ML et affiche le niveau de priorité.

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErreurML, jugerPhoto, type ResultatPhoto } from '@/lib/ml';

const ORANGE = '#EE6A1F';
const FOND = '#F7F4EC';

const LIBELLES = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' } as const;
const COULEURS = { faible: '#2E9E5B', moyenne: '#E0A100', elevee: '#D93A2B' } as const;

type Etat =
  | { type: 'chargement' }
  | { type: 'erreur'; message: string }
  | { type: 'ok'; resultat: ResultatPhoto };

export default function EcranResultat() {
  const router = useRouter();
  const { photo } = useLocalSearchParams<{ photo: string }>();
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!photo) return;
    let actif = true;
    jugerPhoto(photo)
      .then((resultat) => actif && setEtat({ type: 'ok', resultat }))
      .catch((e) => {
        if (actif) {
          setEtat({ type: 'erreur', message: e instanceof ErreurML ? e.message : String(e) });
        }
      });
    return () => {
      actif = false;
    };
  }, [photo, essai]);

  return (
    <SafeAreaView style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {photo && <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />}

        <View style={styles.carte}>
          {etat.type === 'chargement' && (
            <View style={styles.centre}>
              <ActivityIndicator size="large" color={ORANGE} />
              <Text style={styles.secondaire}>Analyse de la photo…</Text>
            </View>
          )}

          {etat.type === 'erreur' && (
            <View style={styles.centre}>
              <Text style={styles.erreur}>{etat.message}</Text>
              <Pressable
                style={styles.boutonSecondaire}
                onPress={() => {
                  setEtat({ type: 'chargement' });
                  setEssai(essai + 1);
                }}>
                <Text style={styles.texteSecondaire}>Réessayer</Text>
              </Pressable>
            </View>
          )}

          {etat.type === 'ok' && <Resultat resultat={etat.resultat} />}
        </View>
      </ScrollView>

      <Pressable style={styles.bouton} onPress={() => router.back()}>
        <Text style={styles.texteBouton}>Nouvelle photo</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Resultat({ resultat }: { resultat: ResultatPhoto }) {
  if (!resultat.valide || resultat.score_gravite === null || resultat.gravite === null) {
    return (
      <View style={styles.centre}>
        <Text style={styles.titre}>Photo non valide</Text>
        <Text style={styles.secondaire}>
          On ne voit pas d’égout ou de grille ({100 - resultat.probabilite_valide} % de certitude).
          Reprends la photo en cadrant l’égout.
        </Text>
      </View>
    );
  }

  const couleur = COULEURS[resultat.gravite];
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>Niveau de priorité</Text>
      <View style={styles.ligne}>
        <Text style={[styles.score, { color: couleur }]}>{resultat.score_gravite} %</Text>
        <View style={[styles.pastille, { backgroundColor: couleur }]}>
          <Text style={styles.textePastille}>{LIBELLES[resultat.gravite]}</Text>
        </View>
      </View>

      <View style={styles.jauge}>
        <View style={[styles.jaugeRemplie, { width: `${resultat.score_gravite}%`, backgroundColor: couleur }]} />
      </View>

      <Text style={styles.secondaire}>Photo valide à {resultat.probabilite_valide} %</Text>

      <View style={styles.detail}>
        {(Object.entries(resultat.probabilites) as [string, number][]).map(([classe, p]) => (
          <View key={classe} style={styles.ligneDetail}>
            <Text style={styles.secondaire}>{classe}</Text>
            <Text style={styles.secondaire}>{p} %</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: FOND, padding: 16, gap: 16 },
  contenu: { gap: 16 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20 },
  carte: { backgroundColor: 'white', borderRadius: 20, padding: 20, minHeight: 160, justifyContent: 'center' },
  centre: { alignItems: 'center', gap: 12 },
  bloc: { gap: 12 },
  etiquette: { fontSize: 16, color: '#6B675F', fontWeight: '600' },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: 56, fontWeight: '800' },
  pastille: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  textePastille: { color: 'white', fontWeight: '700', fontSize: 16 },
  jauge: { height: 10, borderRadius: 5, backgroundColor: '#EEE9DE', overflow: 'hidden' },
  jaugeRemplie: { height: '100%', borderRadius: 5 },
  detail: { borderTopWidth: 1, borderTopColor: '#EEE9DE', paddingTop: 10, gap: 4 },
  ligneDetail: { flexDirection: 'row', justifyContent: 'space-between' },
  titre: { fontSize: 22, fontWeight: '700', color: '#2A2724' },
  secondaire: { fontSize: 15, color: '#6B675F', textAlign: 'center' },
  erreur: { fontSize: 16, color: '#D93A2B', textAlign: 'center' },
  bouton: { height: 56, borderRadius: 28, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  texteBouton: { color: 'white', fontSize: 18, fontWeight: '700' },
  boutonSecondaire: { borderRadius: 20, borderWidth: 1, borderColor: ORANGE, paddingHorizontal: 18, paddingVertical: 8 },
  texteSecondaire: { color: ORANGE, fontWeight: '600' },
});
