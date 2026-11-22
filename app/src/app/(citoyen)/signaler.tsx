import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COULEUR_AVIS } from '@/components/citoyen-essai/style';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Carte, Repere, type CarteCommandes } from '@/components/carte';
import { Champ } from '@/components/ville/champ';
import { useCouleursTexte } from '@/components/ville/couleurs';
import { CIBLE_MIN, COULEUR_ACCENT } from '@/components/ville/style';
import { useCreerSignalement } from '@/hooks/use-creer-signalement';
import { usePosition } from '@/hooks/use-position';
import { usePositionCarte } from '@/hooks/use-position-carte';
import { dansQuartier, messagePositionCarte, RAYON_CITOYEN_M } from '@/lib/position-citoyen';
import { MESSAGE_RECHERCHE_INDISPONIBLE, useRechercheAdresse } from '@/hooks/use-recherche-adresse';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { useZoneEau } from '@/hooks/use-zone-eau';
import { erreursSignalement } from '@/lib/champs';
import { jugerPhoto, type ResultatPhoto } from '@/lib/ml';
import {
  analyseDisponible,
  graviteDuSignalement,
  MESSAGE_ANALYSE_INDISPONIBLE,
  MESSAGE_PHOTO_ACCEPTEE,
  MESSAGE_PHOTO_EN_VERIFICATION,
  MESSAGE_PHOTO_PAS_EGOUT,
} from '@/lib/suggestion-gravite';
import PhotoStep, { type VerificationPhoto } from '../../../frontend/citizen/PhotoStep';
import { IllustrationProbleme } from '@/components/illustration-probleme';
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
  CATEGORIES_PROPOSEES,
  LIBELLES_CATEGORIE,
  type Categorie,
  type Coordonnees,
  type ResultatRecherche,
} from '@/types';

const CATEGORIES: Categorie[] = CATEGORIES_PROPOSEES;

/**
 * Analyse de la photo par le serveur de ML, lancée dès que la photo est prise ou choisie.
 * Une photo qui ne montre pas un égout est refusée (retirée). Le citoyen ne voit jamais le niveau de gravité.
 */
type EtatAnalyse =
  | { statut: 'aucune' }
  | { statut: 'en_cours'; uri: string }
  | { statut: 'acceptee'; uri: string; resultat: ResultatPhoto }
  | { statut: 'refusee' }
  | { statut: 'impossible'; uri: string };

const MESSAGES_VERIFICATION: Record<VerificationPhoto['statut'], string> = {
  en_cours: MESSAGE_PHOTO_EN_VERIFICATION,
  acceptee: MESSAGE_PHOTO_ACCEPTEE,
  refusee: MESSAGE_PHOTO_PAS_EGOUT,
  impossible: MESSAGE_ANALYSE_INDISPONIBLE,
};

function verificationAffichee(a: EtatAnalyse): VerificationPhoto | null {
  return a.statut === 'aucune' ? null : { statut: a.statut, message: MESSAGES_VERIFICATION[a.statut] };
}

const TITRE_CARTE: Partial<Record<Categorie, string>> = {
  grille_bouchee: 'Égout bouché',
  eau_accumulee: "Accumulation d'eau ou inondation",
  affaissement: "Affaissement autour d'un égout",
  grille_endommagee: "Grille d'égout endommagée",
};
type Etape = 'probleme' | 'photo' | 'formulaire';

export default function Signaler() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const couleursTexte = useCouleursTexte();
  const { etat } = useSource();
  const region = useMemo(() => chargerRegion(), []);
  const { envoyer, envoiEnCours } = useCreerSignalement();
  const { position, permission, demander } = usePosition();
  const { chercher, indisponible: rechercheIndisponible } = useRechercheAdresse();
  // Le lieu peut venir de la carte (toucher la carte ou un regard).
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const [point, setPoint] = useState<Coordonnees | null>(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    return params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  });
  const [demandePosition, setDemandePosition] = useState(false);
  const [texteAdresse, setTexteAdresse] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [etape, setEtape] = useState<Etape>('probleme');
  const [analyse, setAnalyse] = useState<EtatAnalyse>({ statut: 'aucune' });
  // Analyse en cours ou finie de la photo actuelle : l'envoi l'attend si elle n'est pas finie.
  const analyseRef = useRef<{ uri: string; promesse: Promise<ResultatPhoto | null> } | null>(null);
  const [attenteAnalyse, setAttenteAnalyse] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [aEssaye, setAEssaye] = useState(false);
  const [envoyeId, setEnvoyeId] = useState<string | null>(null);
  // La gravité n'est pas choisie par le citoyen : elle vient de l'analyse de la photo (faible sans analyse).
  // Le nombre de signalements non résolus au même endroit s'ajoute ensuite côté ville (regrouper, gravite.ts).
  const gravite = graviteDuSignalement(analyse.statut === 'acceptee' && analyse.uri === photoUri ? analyse.resultat : null);
  const verification = verificationAffichee(analyse);
  // Après un premier essai d'envoi, chaque champ invalide le dit et l'erreur disparaît dès qu'il est corrigé.
  const erreursChamps = aEssaye ? erreursSignalement({ point, categorie, gravite, commentaire }) : {};
  const zone = useZoneEau(point);
  const carteRef = useRef<CarteCommandes>(null);
  const { position: positionCarte, statut: statutCarte } = usePositionCarte();
  const dejaCentre = useRef(false);
  const messageCarte = messagePositionCarte(statutCarte, positionCarte, region);

  // Par défaut, la carte est centrée sur la position du citoyen (s'il est dans le quartier) ; le lieu du signalement reste à choisir.
  useEffect(() => {
    if (dejaCentre.current || !positionCarte || !dansQuartier(positionCarte, region) || !carteRef.current) return;
    dejaCentre.current = true;
    carteRef.current.surPosition(positionCarte, RAYON_CITOYEN_M);
  }, [positionCarte, region]);

  // La carte se recentre sur le point choisi (position, adresse ou toucher).
  useEffect(() => {
    if (point) carteRef.current?.centrer(point);
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

  // Dès qu'une photo est prise ou choisie, elle part au serveur d'analyse ; une analyse d'une ancienne photo est ignorée.
  function changerPhoto(uri: string | undefined) {
    setPhotoUri(uri ?? null);
    if (!uri) {
      analyseRef.current = null;
      setAnalyse({ statut: 'aucune' });
      return;
    }
    if (analyseRef.current?.uri === uri) return;
    if (!analyseDisponible()) {
      analyseRef.current = { uri, promesse: Promise.resolve(null) };
      setAnalyse({ statut: 'impossible', uri });
      return;
    }
    setAnalyse({ statut: 'en_cours', uri });
    const promesse = jugerPhoto(uri).then(
      (resultat) => {
        if (analyseRef.current?.uri !== uri) return resultat;
        if (resultat.valide) setAnalyse({ statut: 'acceptee', uri, resultat });
        else {
          // Pas un égout : la photo n'est pas gardée.
          analyseRef.current = null;
          setPhotoUri(null);
          setAnalyse({ statut: 'refusee' });
        }
        return resultat;
      },
      () => {
        if (analyseRef.current?.uri === uri) setAnalyse({ statut: 'impossible', uri });
        return null;
      },
    );
    analyseRef.current = { uri, promesse };
  }

  async function valider() {
    setMessages([]);
    setAEssaye(true);
    const invalides = erreursSignalement({ point, categorie, gravite, commentaire });
    if (!point || !categorie || invalides.commentaire) return;
    // Si la vérification de la photo n'est pas finie, on l'attend ; une photo refusée bloque l'envoi.
    let graviteEnvoyee = gravite;
    if (photoUri && analyseRef.current?.uri === photoUri) {
      setAttenteAnalyse(true);
      let resultat: ResultatPhoto | null;
      try {
        resultat = await analyseRef.current.promesse;
      } finally {
        setAttenteAnalyse(false);
      }
      if (resultat && !resultat.valide) {
        setMessages([MESSAGE_PHOTO_PAS_EGOUT]);
        return;
      }
      graviteEnvoyee = graviteDuSignalement(resultat);
    }
    const r = await envoyer({
      latitude: point.latitude,
      longitude: point.longitude,
      categorie,
      gravite: graviteEnvoyee,
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

  // Étape 1 : feuille « Quel problème avez-vous observé ? » (grille 2 x 2), montée depuis le bas.
  if (etape === 'probleme') {
    return (
      <View style={styles.voile}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable style={styles.fondFeuille} accessibilityRole="button" accessibilityLabel="Fermer sans signaler" onPress={() => router.back()} />
        <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 20 }]}>
          <View style={[styles.poignee, { backgroundColor: theme.borderForte }]} />
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.titreFeuille} maxFontSizeMultiplier={1.3}>
            Quel problème avez-vous observé ?
          </ThemedText>
          <View style={styles.grille}>
            {CATEGORIES.map((c) => {
              const choisi = categorie === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={TITRE_CARTE[c] ?? LIBELLES_CATEGORIE[c]}
                  onPress={() => setCategorie(c)}
                  style={[
                    styles.carteProbleme,
                    { backgroundColor: choisi ? theme.accentDoux : theme.surface, borderColor: choisi ? theme.accent : theme.border, borderWidth: choisi ? 3 : 1 },
                  ]}>
                  <View style={styles.dessin}>
                    <IllustrationProbleme categorie={c} taille={84} />
                  </View>
                  <ThemedText type="smallBold" style={styles.texteProbleme} maxFontSizeMultiplier={1.3}>
                    {TITRE_CARTE[c] ?? LIBELLES_CATEGORIE[c]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {erreursChamps.categorie && !categorie ? (
            <ThemedText type="small" accessibilityRole="alert" style={{ color: couleursTexte.erreur }}>
              {erreursChamps.categorie}
            </ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !categorie }}
            onPress={() => (categorie ? setEtape('photo') : setAEssaye(true))}
            style={[styles.continuer, { backgroundColor: categorie ? theme.accent : theme.backgroundSelected }]}>
            <ThemedText type="smallBold" style={{ color: categorie ? theme.surface : theme.textSecondary, fontSize: 18 }}>
              Continuer
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  // Étape 2 : photo du problème (facultative).
  if (etape === 'photo') {
    return (
      <View style={styles.fond}>
        <Stack.Screen options={{ headerShown: false }} />
        <PhotoStep
          photoUri={photoUri ?? undefined}
          onPhoto={changerPhoto}
          verification={verification}
          onBack={() => setEtape('probleme')}
          onSkip={() => setEtape('formulaire')}
          onContinue={() => setEtape('formulaire')}
        />
      </View>
    );
  }

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
              <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
                {rechercheIndisponible ? MESSAGE_RECHERCHE_INDISPONIBLE : 'Aucune adresse trouvée.'}
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
            <Carte
              commandes={carteRef}
              style={styles.carte}
              regionInitiale={region}
              positionUtilisateur={statutCarte === 'ok'}
              onPress={setPoint}
              accessibilityLabel="Carte pour choisir le lieu du problème">
              {point ? <Repere id="lieu-du-probleme" position={point} couleur={COULEUR_ACCENT} etat="prochain" titre="Lieu du problème" /> : null}
            </Carte>
            {messageCarte ? (
              <ThemedText type="small" themeColor="textSecondary">
                {messageCarte}
              </ThemedText>
            ) : null}
            {point ? (
              <ThemedText type="small">Lieu choisi : {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</ThemedText>
            ) : null}
            {erreursChamps.lieu && !point ? (
              <ThemedText type="small" accessibilityRole="alert" style={{ color: couleursTexte.erreur }}>
                {erreursChamps.lieu}
              </ThemedText>
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
              2. Problème choisi
            </ThemedText>
            <View style={styles.rangee}>
              <ThemedText>{categorie ? LIBELLES_CATEGORIE[categorie] : ''}</ThemedText>
              <Bouton titre="Changer" variante="discret" onPress={() => setEtape('probleme')} />
            </View>

            <ThemedText type="smallBold" accessibilityRole="header">
              3. Photo du problème
            </ThemedText>
            <View style={styles.rangee}>
              <Bouton titre={photoUri ? 'Changer la photo' : 'Ajouter une photo'} variante="discret" onPress={() => setPhotoOuverte(true)} />
            </View>
            {photoUri ? (
              <View style={styles.photoBloc}>
                <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo jointe" />
                <Bouton titre="Retirer la photo" variante="discret" onPress={() => changerPhoto(undefined)} />
              </View>
            ) : null}
            {verification ? (
              <ThemedText type="small" accessibilityLiveRegion="polite" themeColor={verification.statut === 'en_cours' ? 'textSecondary' : undefined}>
                {verification.message}
              </ThemedText>
            ) : null}

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
              erreur={erreursChamps.commentaire}
            />

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
                titre={attenteAnalyse ? 'Analyse de la photo…' : envoiEnCours ? 'Envoi…' : 'Envoyer le signalement'}
                onPress={() => void valider()}
                actif={!envoiEnCours && !attenteAnalyse}
              />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
      <Modal visible={photoOuverte} animationType="slide" onRequestClose={() => setPhotoOuverte(false)}>
        <PhotoStep
          photoUri={photoUri ?? undefined}
          onPhoto={changerPhoto}
          verification={verification}
          onBack={() => setPhotoOuverte(false)}
          onSkip={() => setPhotoOuverte(false)}
          onContinue={() => setPhotoOuverte(false)}
        />
      </Modal>
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
  voile: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  fondFeuille: { flex: 1 },
  feuille: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  poignee: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3 },
  titreFeuille: { textAlign: 'center', fontSize: 24, lineHeight: 30 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  carteProbleme: { flexBasis: '47%', flexGrow: 1, borderRadius: 22, padding: 10, alignItems: 'center', minHeight: 150, justifyContent: 'space-between' },
  dessin: { height: 84, alignItems: 'center', justifyContent: 'center' },
  texteProbleme: { textAlign: 'center' },
  continuer: { minHeight: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
