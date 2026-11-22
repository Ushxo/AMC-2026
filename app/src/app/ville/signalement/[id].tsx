import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteGravite, EtiquetteNeutre } from '@/components/ville/etiquette';
import { useChangerEtat } from '@/hooks/use-changer-etat';
import { useSignalements } from '@/hooks/use-signalements';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { formaterDate, formaterPosition } from '@/lib/format';
import { urlPhotoSure } from '@/lib/photo';
import {
  LIBELLES_CATEGORIE,
  LIBELLES_ETAT,
  type ChangementEtat,
  type Etat,
} from '@/types';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];

export default function FicheSignalement() {
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { etat: etatSource } = useSource();
  const { changer, historique } = useChangerEtat();
  const { demoHorsLigne: simule } = useSessionEmploye();
  const { signalements, chargement, erreur, rafraichir } = useSignalements();
  const [changements, setChangements] = useState<ChangementEtat[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const signalement = useMemo(() => signalements.find((s) => s.id === id), [signalements, id]);

  const chargerHistorique = useCallback(async () => {
    if (id) setChangements(await historique(id));
  }, [id, historique]);

  useEffect(() => {
    const t = setTimeout(() => void chargerHistorique(), 0);
    return () => clearTimeout(t);
  }, [chargerHistorique, signalement?.etat]);

  async function choisir(e: Etat) {
    if (!signalement) return;
    setEnCours(true);
    const refus = await changer(signalement.id, e);
    setMessage(refus ?? (simule ? `État changé : ${LIBELLES_ETAT[e]} (simulé).` : `État changé : ${LIBELLES_ETAT[e]}.`));
    setEnCours(false);
  }

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
          <BandeauSource etat={etatSource} simule={simule} />
          {chargement ? (
            <Chargement />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : !signalement ? (
            <Vide texte="Ce signalement est introuvable." />
          ) : (
            <>
              {urlPhotoSure(signalement.photo_url) ? (
                <Image
                  source={{ uri: urlPhotoSure(signalement.photo_url)! }}
                  style={styles.photo}
                  contentFit="cover"
                  accessibilityLabel="Photo jointe au signalement"
                />
              ) : (
                <ThemedText themeColor="textSecondary">
                  {signalement.photo_url ? 'Photo non affichée (adresse non reconnue).' : 'Aucune photo jointe.'}
                </ThemedText>
              )}
              <ThemedText type="subtitle" accessibilityRole="header">
                {LIBELLES_CATEGORIE[signalement.categorie]}
              </ThemedText>
              <View style={styles.rangee}>
                <EtiquetteGravite gravite={signalement.gravite} />
                <EtiquetteNeutre texte={LIBELLES_ETAT[signalement.etat]} />
                {signalement.exemple_demo ? <EtiquetteNeutre texte="Exemple de démo" /> : null}
                {signalement.en_attente ? <EtiquetteNeutre texte="En attente d'envoi" /> : null}
              </View>
              {signalement.echec_envoi ? (
                <ThemedText accessibilityRole="alert">Envoi refusé : {signalement.echec_envoi}</ThemedText>
              ) : null}
              <ThemedText>Signalé le {formaterDate(signalement.cree_le)}</ThemedText>
              <ThemedText>Position : {formaterPosition(signalement.latitude, signalement.longitude)}</ThemedText>
              {signalement.commentaire ? <ThemedText>« {signalement.commentaire} »</ThemedText> : null}

              <ThemedText type="smallBold" accessibilityRole="header">
                Changer l&apos;état
              </ThemedText>
              <View style={styles.rangee}>
                {ETATS.map((e) => (
                  <Bouton
                    key={e}
                    titre={LIBELLES_ETAT[e]}
                    variante={e === signalement.etat ? 'discret' : 'plein'}
                    selectionne={e === signalement.etat}
                    actif={!enCours && e !== signalement.etat}
                    onPress={() => void choisir(e)}
                  />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                État actuel : {LIBELLES_ETAT[signalement.etat]}
              </ThemedText>
              {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}

              <ThemedText type="smallBold" accessibilityRole="header">
                Historique des états
              </ThemedText>
              {changements.length === 0 ? (
                <ThemedText themeColor="textSecondary">Aucun changement pour le moment.</ThemedText>
              ) : (
                changements.map((c) => (
                  <ThemedText key={c.id} type="small">
                    {formaterDate(c.change_le)} : {LIBELLES_ETAT[c.ancien_etat]} → {LIBELLES_ETAT[c.nouvel_etat]}
                  </ThemedText>
                ))
              )}
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
  photo: { width: '100%', height: 240, borderRadius: 16 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
