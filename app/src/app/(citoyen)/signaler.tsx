import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import type { MapPressEvent } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COULEUR_AVIS } from '@/components/citoyen-essai/style';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { CarteCommune } from '@/components/ville/carte-commune';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { Champ } from '@/components/ville/champ';
import { CIBLE_MIN, COULEUR_ACCENT } from '@/components/ville/style';
import { useCreerSignalement } from '@/hooks/use-creer-signalement';
import { usePosition } from '@/hooks/use-position';
import { useRechercheAdresse } from '@/hooks/use-recherche-adresse';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { useZoneEau } from '@/hooks/use-zone-eau';
import { chargerRegion } from '@/lib/officiel';
import {
  MESSAGE_ECHEC_ENVOI,
  MESSAGE_EN_ATTENTE,
  MESSAGE_EN_ATTENTE_SANS_PHOTO,
  MESSAGE_ENVOYE,
  MESSAGE_ENVOYE_SANS_PHOTO,
  MESSAGE_POSITION_REFUSEE,
} from '@/lib/messages';
import {
  LIBELLES_CATEGORIE,
  LIBELLES_GRAVITE,
  type Categorie,
  type Coordonnees,
  type Gravite,
  type ResultatRecherche,
} from '@/types';

const CATEGORIES: Categorie[] = ['grille_bouchee', 'eau_accumulee', 'eau_douteuse', 'absence_eau', 'autre'];
const GRAVITES: Gravite[] = ['faible', 'moyenne', 'elevee'];

export default function Signaler() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const { etat } = useSource();
  const region = useMemo(() => chargerRegion(), []);
  const { envoyer, envoiEnCours } = useCreerSignalement();
  const { position, permission, demander } = usePosition();
  const { chercher } = useRechercheAdresse();
  const [point, setPoint] = useState<Coordonnees | null>(null);
  const [demandePosition, setDemandePosition] = useState(false);
  const [texteAdresse, setTexteAdresse] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [gravite, setGravite] = useState<Gravite | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [envoyeId, setEnvoyeId] = useState<string | null>(null);
  const zone = useZoneEau(point);
  const carteRef = useRef<MapView>(null);

  // La carte se recentre sur le point choisi (position, adresse ou toucher).
  useEffect(() => {
    if (point) carteRef.current?.animateToRegion({ ...region, latitude: point.latitude, longitude: point.longitude }, 400);
  }, [point, region]);

  // Quand l'utilisateur a demandé sa position, on la prend dès qu'elle arrive.
  useEffect(() => {
    if (!demandePosition || !position) return;
    const t = setTimeout(() => {
      setPoint(position);
      setDemandePosition(false);
    }, 0);
    return () => clearTimeout(t);
  }, [demandePosition, position]);

  async function maPosition() {
    setDemandePosition(true);
    await demander();
  }

  async function lancerRecherche() {
    setResultats(await chercher(texteAdresse));
  }

  async function ajouterPhoto(source: 'camera' | 'galerie') {
    try {
      const droit =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!droit.granted) {
        setMessages(["L'accès à la photo est refusé. Vous pouvez envoyer le signalement sans photo."]);
        return;
      }
      const r =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
    } catch {
      setMessages(["La photo n'a pas pu être ajoutée. Vous pouvez envoyer le signalement sans photo."]);
    }
  }

  async function valider() {
    setMessages([]);
    if (!point || !categorie || !gravite) {
      const manque: string[] = [];
      if (!point) manque.push('Choisissez le lieu : votre position, une adresse ou un point sur la carte.');
      if (!categorie) manque.push('Choisissez ce que vous signalez.');
      if (!gravite) manque.push('Choisissez la gravité du problème.');
      setMessages(manque);
      return;
    }
    const r = await envoyer({
      latitude: point.latitude,
      longitude: point.longitude,
      categorie,
      gravite,
      commentaire: commentaire.trim() || undefined,
      photoUri: photoUri ?? undefined,
    });
    if (r.statut === 'invalide') {
      setMessages(r.erreurs.map((e) => e.message));
    } else if (r.statut === 'echec') {
      setMessages([r.message]);
    } else if (r.statut === 'envoye') {
      setEnvoyeId(r.signalement.id);
      setMessages([r.sansPhoto ? MESSAGE_ENVOYE_SANS_PHOTO : MESSAGE_ENVOYE]);
    } else {
      setEnvoyeId(r.signalement.id);
      const base = r.sansPhoto ? MESSAGE_EN_ATTENTE_SANS_PHOTO : MESSAGE_EN_ATTENTE;
      setMessages(r.signalement.echec_envoi ? [base, `${MESSAGE_ECHEC_ENVOI} ${r.signalement.echec_envoi}`] : [base]);
    }
  }

  const termine = envoyeId !== null;

  return (
    <ThemedView style={styles.fond}>
      <Stack.Screen options={{ title: 'Signaler un problème' }} />
      <SafeAreaView style={styles.fond} edges={[]}>
        <View style={styles.fond}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <BandeauSource etat={etat} />

            <ThemedText type="smallBold" accessibilityRole="header">
              1. Où est le problème ?
            </ThemedText>
            <View style={styles.rangee}>
              <Bouton titre="Utiliser ma position" variante="discret" onPress={() => void maPosition()} />
            </View>
            {permission === 'refusee' ? <ThemedText type="small">{MESSAGE_POSITION_REFUSEE}</ThemedText> : null}
            <Champ
              etiquette="Ou cherchez une adresse"
              value={texteAdresse}
              onChangeText={setTexteAdresse}
              onSubmitEditing={() => void lancerRecherche()}
              returnKeyType="search"
              autoCorrect={false}
            />
            <Bouton titre="Chercher" variante="discret" onPress={() => void lancerRecherche()} />
            {resultats && resultats.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Aucune adresse trouvée.
              </ThemedText>
            ) : null}
            {(resultats ?? []).map((r) => (
              <Pressable
                key={`${r.libelle}-${r.position.latitude}`}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${r.libelle}`}
                onPress={() => {
                  setPoint(r.position);
                  setResultats(null);
                }}
                style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText>{r.libelle}</ThemedText>
              </Pressable>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Vous pouvez aussi toucher la carte pour placer le point.
            </ThemedText>
            <CarteCommune
              ref={carteRef}
              style={styles.carte}
              initialRegion={region}
              onPress={(e: MapPressEvent) => setPoint(e.nativeEvent.coordinate)}
              accessibilityLabel="Carte pour choisir le lieu du problème">
              {point ? <MarqueurEgout coordinate={point} couleur={COULEUR_ACCENT} etat="prochain" title="Lieu du problème" /> : null}
            </CarteCommune>
            {point ? (
              <ThemedText type="small">Lieu choisi : {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</ThemedText>
            ) : null}
            {zone.dansZone ? (
              <View accessibilityRole="alert" style={[styles.avis, { borderColor: COULEUR_AVIS }]}>
                <ThemedText type="smallBold">Avis d&apos;eau près de ce lieu</ThemedText>
                {zone.avis.map((a) => (
                  <ThemedText key={a.properties.id} type="small">
                    {a.properties.titre}
                  </ThemedText>
                ))}
              </View>
            ) : null}

            <ThemedText type="smallBold" accessibilityRole="header">
              2. Que signalez-vous ?
            </ThemedText>
            <View style={styles.rangee}>
              {CATEGORIES.map((c) => (
                <Bouton
                  key={c}
                  titre={LIBELLES_CATEGORIE[c]}
                  variante="discret"
                  selectionne={categorie === c}
                  onPress={() => setCategorie(c)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" accessibilityRole="header">
              3. Quelle est la gravité ?
            </ThemedText>
            <View style={styles.rangee}>
              {GRAVITES.map((g) => (
                <Bouton
                  key={g}
                  titre={LIBELLES_GRAVITE[g]}
                  variante="discret"
                  selectionne={gravite === g}
                  onPress={() => setGravite(g)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" accessibilityRole="header">
              4. Un détail à ajouter ? (facultatif)
            </ThemedText>
            <Champ
              etiquette="Commentaire (500 caractères au plus)"
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              maxLength={500}
              style={styles.commentaire}
            />
            <View style={styles.rangee}>
              <Bouton titre="Prendre une photo" variante="discret" onPress={() => void ajouterPhoto('camera')} />
              <Bouton titre="Choisir une photo" variante="discret" onPress={() => void ajouterPhoto('galerie')} />
            </View>
            {photoUri ? (
              <View style={styles.photoBloc}>
                <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo jointe" />
                <Bouton titre="Retirer la photo" variante="discret" onPress={() => setPhotoUri(null)} />
              </View>
            ) : null}

            {messages.map((m) => (
              <ThemedText key={m} accessibilityRole="alert">
                {m}
              </ThemedText>
            ))}
            {termine ? (
              <View style={styles.rangee}>
                <Bouton
                  pleineLargeur
                  titre="Suivre mon signalement"
                  onPress={() => router.replace({ pathname: '/suivi/[id]', params: { id: envoyeId } })}
                />
                <Bouton titre="Retour à la carte" variante="discret" onPress={() => router.replace('/')} />
              </View>
            ) : (
              <Bouton
                pleineLargeur
                titre={envoiEnCours ? 'Envoi…' : 'Envoyer le signalement'}
                onPress={() => void valider()}
                actif={!envoiEnCours}
              />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { minHeight: CIBLE_MIN, padding: 12, borderRadius: 12, justifyContent: 'center' },
  carte: { height: 240, borderRadius: 14 },
  avis: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 4 },
  commentaire: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  photoBloc: { gap: 8 },
  photo: { width: '100%', height: 200, borderRadius: 14 },
});
