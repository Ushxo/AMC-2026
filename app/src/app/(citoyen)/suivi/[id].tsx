import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Texte as Text } from '@/components/texte';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteNeutre } from '@/components/ville/etiquette';
import { usePassage } from '@/hooks/use-passage';
import { useSignalements } from '@/hooks/use-signalements';
import { formaterDate } from '@/lib/format';
import { confirmationDuSignalement, indexerEndroits } from '@/lib/gravite';
import { ETIQUETTE_EN_ATTENTE_CONFIRMATION, phraseManque } from '@/lib/messages-seuil';
import { lieuDeEndroit } from '@/lib/interventions';
import { MESSAGE_RESULTAT_PRECALCULE } from '@/lib/messages';
import { chargerAdresses } from '@/lib/officiel';
import { etatsDesEtapes, type EtatEtape } from '@/lib/suivi-etapes';
import { LIBELLES_CATEGORIE, LIBELLES_SUIVI } from '@/types';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';


function Point({ etat }: { etat: EtatEtape }) {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  if (etat === 'avenir') return <View style={styles.pointVide} />;
  return (
    <View style={[styles.point, { backgroundColor: etat === 'fait' ? P.success : P.action }]}>
      <Ionicons name="checkmark" size={16} color={P.onHeader} />
    </View>
  );
}

export default function SuiviSignalement() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { bottom, top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { suivi, chargement, erreur } = usePassage(id);
  const { signalements, rafraichir } = useSignalements();
  const signalement = useMemo(() => signalements.find((s) => s.id === id), [signalements, id]);
  const adresses = useMemo(() => chargerAdresses(), []);
  const confirmation = useMemo(
    () => (signalement ? confirmationDuSignalement(signalement, indexerEndroits(signalements)) : { enAttente: false, manque: 0 }),
    [signalement, signalements],
  );
  const etats = etatsDesEtapes(suivi.etape);
  const rejete = suivi.etape === 'rejete';

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.fond}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.entete, { paddingTop: top + 14 }]}>
        <Pressable onPress={retour} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color={P.onHeader} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            Suivi de l&apos;alerte
          </Text>
          {signalement ? (
            <Text style={styles.sousTitre} maxFontSizeMultiplier={1.3}>
              {LIBELLES_CATEGORIE[signalement.categorie]}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
        {chargement ? (
          <Chargement />
        ) : erreur ? (
          <Erreur message={erreur} onReessayer={() => void rafraichir()} />
        ) : !signalement ? (
          <Vide texte="Ce signalement est introuvable." />
        ) : (
          <>
            {confirmation.enAttente ? (
              <View style={styles.attente} accessible accessibilityLabel={`${ETIQUETTE_EN_ATTENTE_CONFIRMATION}. ${phraseManque(confirmation.manque)}`}>
                <EtiquetteNeutre texte={ETIQUETTE_EN_ATTENTE_CONFIRMATION} />
                <Text style={styles.note}>{phraseManque(confirmation.manque)}</Text>
              </View>
            ) : null}
            {suivi.etape === 'planifie' && suivi.heure_estimee ? (
              <View style={styles.passage}>
                <Ionicons name="time-outline" size={38} color={P.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.passageLegende}>Passage prévu de l&apos;équipe</Text>
                  <Text style={styles.passageHeure} maxFontSizeMultiplier={1.3}>
                    Vers {suivi.heure_estimee}
                  </Text>
                  <Text style={styles.passageNote}>Heure estimée, elle peut changer.</Text>
                  {suivi.precalcule ? <EtiquetteNeutre texte={MESSAGE_RESULTAT_PRECALCULE} /> : null}
                </View>
              </View>
            ) : suivi.etape === 'recu' ? (
              <Text style={styles.note}>Pas encore planifié : l&apos;heure de passage apparaîtra ici.</Text>
            ) : null}

            <View style={styles.carte}>
              {rejete ? (
                <Text style={styles.etapeTitre} accessibilityRole="alert">
                  {LIBELLES_SUIVI.rejete}
                </Text>
              ) : (
                [
                  { titre: 'Soumis', detail: `Le ${formaterDate(signalement.cree_le)}` },
                  { titre: 'Prise en charge', detail: "Dans la tournée d'une équipe" },
                  { titre: 'Terminé', detail: "Après le passage de l'équipe" },
                ].map((e, i) => (
                  <View
                    key={e.titre}
                    style={styles.etape}
                    accessible
                    accessibilityLabel={`${e.titre}, ${etats[i] === 'fait' ? 'terminée' : etats[i] === 'courant' ? 'étape actuelle' : 'à venir'}. ${e.detail}`}
                  >
                    <View style={styles.colonne}>
                      <Point etat={etats[i]} />
                      {i < 2 ? <View style={[styles.trait, { backgroundColor: etats[i] === 'fait' ? P.success : P.border }]} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: i < 2 ? 14 : 0 }}>
                      <Text style={[styles.etapeTitre, etats[i] === 'avenir' && { color: P.textSecondary }]}>{e.titre}</Text>
                      <Text style={styles.etapeDetail}>{e.detail}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.carte}>
              <View style={styles.ligneLieu}>
                <Ionicons name="location-outline" size={20} color={P.primary} />
                <Text style={styles.lieu}>{lieuDeEndroit({ latitude: signalement.latitude, longitude: signalement.longitude }, adresses)}</Text>
              </View>
              {signalement.photo_url || signalement.commentaire ? (
                <View style={styles.ligneLieu}>
                  {signalement.photo_url ? <Image source={{ uri: signalement.photo_url }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo jointe" /> : null}
                  {signalement.commentaire ? <Text style={styles.commentaire}>« {signalement.commentaire} »</Text> : null}
                </View>
              ) : null}
            </View>
            {signalement.en_attente ? <Text style={styles.note}>Ce signalement sera envoyé au retour du réseau.</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background },
  entete: { backgroundColor: P.header, paddingHorizontal: 20, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  titre: { color: P.onHeader, fontSize: 26, fontWeight: '700' },
  sousTitre: { color: P.onHeaderSoft, fontSize: 15, fontWeight: '500' },
  contenu: { padding: 20, gap: 16, maxWidth: 800, width: '100%', alignSelf: 'center' },
  passage: { backgroundColor: P.bandeau, borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  passageLegende: { fontSize: 14, fontWeight: '600', color: P.primary },
  passageHeure: { fontSize: 24, fontWeight: '700', color: P.primary },
  passageNote: { fontSize: 13, fontWeight: '500', color: P.textSecondary },
  attente: { gap: 8, alignItems: 'flex-start' },
  note: { fontSize: 14, color: P.textSecondary },
  carte: { backgroundColor: P.surface, borderRadius: 22, padding: 20, gap: 12 },
  etape: { flexDirection: 'row', gap: 16 },
  colonne: { alignItems: 'center' },
  point: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointVide: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: P.borderForte, backgroundColor: P.surface },
  trait: { width: 3, flex: 1, minHeight: 36 },
  etapeTitre: { fontSize: 16, fontWeight: '700', color: P.text },
  etapeDetail: { fontSize: 14, fontWeight: '500', color: P.textSecondary },
  ligneLieu: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lieu: { flex: 1, fontSize: 15, fontWeight: '600', color: P.text },
  photo: { width: 72, height: 72, borderRadius: 16 },
  commentaire: { flex: 1, fontSize: 14, fontWeight: '500', color: P.textSecondary, lineHeight: 20 },
});
