import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COULEUR_AVIS } from '@/components/citoyen-essai/style';
import { ThemedText } from '@/components/themed-text';
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
import { FeuilleProbleme } from '@/components/citoyen/feuille-probleme';
import { lieuDeEndroit } from '@/lib/interventions';
import { chargerAdresses, chargerRegion } from '@/lib/officiel';
import { ecrireBrouillon, lireBrouillon, viderBrouillon } from '@/lib/brouillon-signalement';
import { MESSAGE_GARDE_HORS_LIGNE, MESSAGE_RECU_SANS_CONFIRMATION, MESSAGE_RECU_SIMPLE, MESSAGE_RECU_SUR_CARTE } from '@/lib/messages-seuil';
import { sansBruit } from '@/lib/trace';
import { colonnePhotoManquante } from '@/lib/source';
import {
  MESSAGE_ECHEC_ENVOI,
  MESSAGE_EN_ATTENTE_SANS_PHOTO,
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
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';
import { BoutonAction } from '@/components/bouton-action';

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

// Ligne courte du résumé : l'état de la photo en un coup d'œil (le détail est dans le bandeau sauge).
const ETIQUETTES_RESUME: Record<VerificationPhoto['statut'], string> = {
  en_cours: 'Vérification de la photo…',
  acceptee: 'Photo acceptée',
  refusee: 'Photo refusée : reprenez-en une',
  impossible: 'Photo non vérifiée, jointe telle quelle',
};

function verificationAffichee(a: EtatAnalyse): VerificationPhoto | null {
  return a.statut === 'aucune' ? null : { statut: a.statut, message: MESSAGES_VERIFICATION[a.statut] };
}

type Etape = 'probleme' | 'photo' | 'formulaire';

export default function Signaler() {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const { bottom, top } = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const couleursTexte = useCouleursTexte();
  const { etat } = useSource();
  const region = useMemo(() => chargerRegion(), []);
  const { envoyer, envoiEnCours } = useCreerSignalement();
  const { position, permission, demander } = usePosition();
  const { chercher, indisponible: rechercheIndisponible } = useRechercheAdresse();
  // Le lieu peut venir de la carte (toucher la carte ou un regard).
  const params = useLocalSearchParams<{ lat?: string; lng?: string; categorie?: string }>();
  const categorieInitiale = CATEGORIES.find((c) => c === params.categorie) ?? null;
  // Ouvert depuis la carte (feuille des problèmes derrière) : le retour rouvre la feuille sur la carte, et le brouillon garde la photo.
  const depuisCarte = categorieInitiale !== null;
  const [brouillon] = useState(() => (depuisCarte ? lireBrouillon() : null));
  const [point, setPoint] = useState<Coordonnees | null>(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    return params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : (brouillon?.lieu ?? null);
  });
  const [demandePosition, setDemandePosition] = useState(false);
  const [texteAdresse, setTexteAdresse] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [categorie, setCategorie] = useState<Categorie | null>(categorieInitiale);
  const [commentaire, setCommentaire] = useState(brouillon?.commentaire ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(brouillon?.photoUri ?? null);
  const [lieuOuvert, setLieuOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>(categorieInitiale ? 'photo' : 'probleme');
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

  // Fermer la feuille sans continuer : le brouillon est abandonné.
  function abandonner() {
    fini.current = true;
    viderBrouillon();
    router.back();
  }

  // Retour depuis la photo vers la carte floutée : la feuille se rouvre là-bas (problème et lieu conservés).
  function retourVersCarte() {
    ecrireBrouillon({ feuilleOuverte: true, categorie, lieu: point, photoUri, photoVerifiee: photoVerifieeBrouillon, commentaire });
    router.back();
  }

  async function valider() {
    setMessages([]);
    setAEssaye(true);
    const invalides = erreursSignalement({ point, categorie, gravite, commentaire });
    if (!point || !categorie || invalides.commentaire) return;
    // Si la vérification de la photo n'est pas finie, on l'attend ; une photo refusée bloque l'envoi.
    let graviteEnvoyee = gravite;
    // Photo vérifiée seulement si l'analyse a ACCEPTÉ la photo qui part.
    let photoVerifiee = false;
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
      photoVerifiee = Boolean(resultat?.valide);
    }
    const r = await envoyer({
      latitude: point.latitude,
      longitude: point.longitude,
      categorie,
      gravite: graviteEnvoyee,
      commentaire: commentaire.trim() || undefined,
      photoUri: photoUri ?? undefined,
      photoVerifiee,
    });
    if (r.statut === 'invalide') {
      setMessages(r.erreurs.map((e) => e.message));
    } else if (r.statut === 'echec') {
      setMessages([r.message]);
    } else if (r.statut === 'envoye') {
      fini.current = true;
      viderBrouillon();
      setEnvoyeId(r.signalement.id);
      // Un seul message par cas, sans contradiction : le seuil ne s'applique pas si la base n'a pas la colonne (migration 0011).
      const sansSeuil = colonnePhotoManquante();
      setMessages([
        r.sansPhoto ? MESSAGE_ENVOYE_SANS_PHOTO : sansSeuil ? MESSAGE_RECU_SIMPLE : photoVerifiee ? MESSAGE_RECU_SUR_CARTE : MESSAGE_RECU_SANS_CONFIRMATION,
      ]);
    } else {
      fini.current = true;
      viderBrouillon();
      setEnvoyeId(r.signalement.id);
      // Hors ligne : on dit seulement que le signalement est gardé ; ce qu'il adviendra sur la carte se dira à l'envoi.
      const base = r.sansPhoto ? MESSAGE_EN_ATTENTE_SANS_PHOTO : MESSAGE_GARDE_HORS_LIGNE;
      setMessages(r.signalement.echec_envoi ? [base, `${MESSAGE_ECHEC_ENVOI} ${r.signalement.echec_envoi}`] : [base]);
    }
  }

  const termine = envoyeId !== null;

  // Brouillon : la photo reprise est de nouveau analysée ; chaque changement est gardé pour le retour vers la carte.
  const fini = useRef(false); // envoyé ou abandonné : le brouillon est vidé, rien à rouvrir
  useEffect(() => {
    const uri = brouillon?.photoUri;
    if (!uri) return;
    const t = setTimeout(() => changerPhoto(uri), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const photoVerifieeBrouillon = analyse.statut === 'acceptee' && analyse.uri === photoUri;
  useEffect(() => {
    if (!depuisCarte || fini.current) return;
    ecrireBrouillon({ categorie, lieu: point, photoUri, photoVerifiee: photoVerifieeBrouillon, commentaire });
  }, [depuisCarte, categorie, point, photoUri, photoVerifieeBrouillon, commentaire]);
  // Retour par la flèche ou par le geste : la carte rouvre la feuille des problèmes, le problème déjà choisi.
  const navigation = useNavigation() as unknown as { addListener?: (nom: string, f: () => void) => () => void };
  useEffect(() => {
    if (!depuisCarte) return;
    return navigation.addListener?.('beforeRemove', () => {
      if (!fini.current) ecrireBrouillon({ feuilleOuverte: true });
    });
  }, [depuisCarte, navigation]);

  // Étape 1 (si on arrive sans problème choisi, ou par « Changer ») : la feuille « Quel problème avez-vous observé ? ».
  // Depuis la carte, la feuille s'ouvre sur la carte elle-même (floutée derrière) et cet écran démarre à la photo.
  if (etape === 'probleme') {
    return (
      <View style={[styles.fond, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <FeuilleProbleme
          categorie={categorie}
          onChoisir={setCategorie}
          onContinuer={() => (categorie ? setEtape('photo') : setAEssaye(true))}
          onFermer={abandonner}
          erreur={erreursChamps.categorie && !categorie ? erreursChamps.categorie : null}
        />
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
          onBack={() => (depuisCarte ? retourVersCarte() : setEtape('probleme'))}
          onSkip={() => setEtape('formulaire')}
          onContinue={() => setEtape('formulaire')}
        />
      </View>
    );
  }

  const lieuConnu = point !== null;
  const adresseLieu = point ? lieuDeEndroit(point, chargerAdresses()) : null;

  // Étape 3 : derniers détails (résumé, lieu, photo vérifiée, commentaire), puis l'envoi.
  return (
    <View style={styles.fond}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.enteteVert, { paddingTop: top + 14 }]}>
        <Pressable onPress={() => setEtape('photo')} accessibilityRole="button" accessibilityLabel="Retour à la photo" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color={P.onHeader} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText accessibilityRole="header" style={styles.enteteTitre} maxFontSizeMultiplier={1.3}>
            Derniers détails
          </ThemedText>
          <ThemedText style={styles.enteteSous} maxFontSizeMultiplier={1.3}>
            Étape 3 sur 3
          </ThemedText>
        </View>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.contenu, { paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled">
        <BandeauSource etat={etat} />

        <View style={styles.resume}>
          <View style={styles.vignette}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.vignetteImage} contentFit="cover" accessibilityLabel="Photo jointe" />
            ) : categorie ? (
              <IllustrationProbleme categorie={categorie} taille={52} />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={styles.resumeTitre}>{categorie ? LIBELLES_CATEGORIE[categorie] : ''}</ThemedText>
            <ThemedText style={styles.resumeLieu}>{adresseLieu ?? 'Lieu à choisir'}</ThemedText>
            {verification ? (
              <ThemedText style={[styles.resumePhoto, { color: verification.statut === 'refusee' ? P.danger : verification.statut === 'acceptee' ? P.primary : P.textSecondary }]} accessibilityLiveRegion="polite">
                {ETIQUETTES_RESUME[verification.statut]}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.resumePhoto, { color: P.textSecondary }]}>Sans photo</ThemedText>
            )}
          </View>
          <Pressable onPress={() => setEtape('probleme')} accessibilityRole="button" accessibilityLabel="Changer de problème" style={styles.changer}>
            <ThemedText style={styles.changerTexte}>Changer</ThemedText>
          </Pressable>
        </View>

        {!lieuConnu || lieuOuvert ? (
          <View style={styles.bloc}>
            <ThemedText style={styles.blocTitre} accessibilityRole="header">
              Où est le problème ?
            </ThemedText>
            <View style={styles.rangee}>
              <Bouton titre="Utiliser ma position" variante="discret" onPress={() => sansBruit(maPosition, 'position')} />
            </View>
            {permission === 'refusee' ? <ThemedText type="small">{MESSAGE_POSITION_REFUSEE}</ThemedText> : null}
            <Champ
              etiquette="Ou cherchez une adresse"
              value={texteAdresse}
              onChangeText={setTexteAdresse}
              onSubmitEditing={() => sansBruit(lancerRecherche, 'recherche')}
              returnKeyType="search"
              autoCorrect={false}
            />
            <Bouton titre="Chercher" variante="discret" onPress={() => sansBruit(lancerRecherche, 'recherche')} />
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
            {erreursChamps.lieu && !point ? (
              <ThemedText type="small" accessibilityRole="alert" style={{ color: couleursTexte.erreur }}>
                {erreursChamps.lieu}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => setLieuOuvert(true)} accessibilityRole="button" style={styles.lienLieu}>
            <ThemedText style={styles.changerTexte}>Changer le lieu</ThemedText>
          </Pressable>
        )}
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

        {verification ? (
          <View style={styles.suggestion} accessibilityLiveRegion="polite">
            <ThemedText style={styles.suggestionTexte}>{verification.message}</ThemedText>
          </View>
        ) : null}

        <View style={styles.bloc}>
          <Champ
            etiquette="Commentaire (facultatif)"
            placeholder="Ce que vous voyez, depuis quand…"
            value={commentaire}
            onChangeText={setCommentaire}
            multiline
            maxLength={500}
            style={styles.commentaire}
            erreur={erreursChamps.commentaire}
          />
          <View style={styles.rangee}>
            <Bouton titre={photoUri ? 'Changer la photo' : 'Ajouter une photo (facultatif)'} variante="discret" onPress={() => setEtape('photo')} />
            {photoUri ? (
              <Bouton titre="Retirer la photo" variante="discret" onPress={() => changerPhoto(undefined)} />
            ) : null}
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Sans réseau, le signalement part dès que la connexion revient.
        </ThemedText>
        {messages.map((m) => (
          <ThemedText key={m} accessibilityRole="alert">
            {m}
          </ThemedText>
        ))}
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: bottom + 16 }]}>
        {termine ? (
          <View style={{ gap: 8 }}>
            <Bouton pleineLargeur titre="Suivre mon signalement" onPress={() => router.replace({ pathname: '/suivi/[id]', params: { id: envoyeId } })} />
            <Bouton pleineLargeur titre="Retour à la carte" variante="discret" onPress={() => router.replace('/')} />
          </View>
        ) : (
          <BoutonAction
            titre={attenteAnalyse ? 'Vérification de la photo…' : envoiEnCours ? 'Envoi…' : 'Envoyer le signalement'}
            onPress={() => sansBruit(valider, 'envoi')}
            occupe={envoiEnCours || attenteAnalyse}
          />
        )}
      </View>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { minHeight: CIBLE_MIN, padding: 12, borderRadius: 12, justifyContent: 'center' },
  carte: { height: 240, borderRadius: 16 },
  enteteVert: { backgroundColor: P.header, paddingHorizontal: 20, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  enteteTitre: { color: P.onHeader, fontSize: 26, lineHeight: 34, fontWeight: '700' },
  enteteSous: { color: P.onHeaderSoft, fontSize: 15, fontWeight: '500' },
  resume: { backgroundColor: P.surface, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  vignette: { width: 64, height: 64, borderRadius: 16, backgroundColor: P.bandeau, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vignetteImage: { width: 64, height: 64 },
  resumeTitre: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  resumePhoto: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  resumeLieu: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: P.textSecondary },
  changer: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 4 },
  changerTexte: { fontSize: 15, fontWeight: '600', color: P.primary, textDecorationLine: 'underline' },
  lienLieu: { minHeight: 48, justifyContent: 'center' },
  bloc: { gap: 12 },
  blocTitre: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  suggestion: { backgroundColor: P.bandeau, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  suggestionTexte: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  pied: { paddingHorizontal: 20, paddingTop: 12 },
  avis: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 4 },
  commentaire: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  photoBloc: { gap: 8 },
  photo: { width: '100%', height: 200, borderRadius: 16 },
});
