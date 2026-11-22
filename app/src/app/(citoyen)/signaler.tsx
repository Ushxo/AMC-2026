import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { jugerPhoto } from '@/lib/ml';
import { analyseDisponible, graviteSuggeree, MESSAGE_ANALYSE_INDISPONIBLE, MESSAGE_PHOTO_PAS_EGOUT } from '@/lib/suggestion-gravite';
import PhotoStep from '../../../frontend/citizen/PhotoStep';
import { IllustrationProbleme } from '@/components/illustration-probleme';
import { lieuDeEndroit } from '@/lib/interventions';
import { chargerAdresses, chargerRegion } from '@/lib/officiel';
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
  LIBELLES_GRAVITE,
  type Categorie,
  type Coordonnees,
  type Gravite,
  type ResultatRecherche,
} from '@/types';

const CATEGORIES: Categorie[] = CATEGORIES_PROPOSEES;
const GRAVITES: Gravite[] = ['faible', 'moyenne', 'elevee'];

const TITRE_CARTE: Partial<Record<Categorie, string>> = {
  grille_bouchee: 'Égout bouché',
  eau_accumulee: "Accumulation d'eau ou inondation",
  affaissement: "Affaissement autour d'un égout",
  grille_endommagee: "Grille d'égout endommagée",
};
type Etape = 'probleme' | 'photo' | 'formulaire';

export default function Signaler() {
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
  const [gravite, setGravite] = useState<Gravite | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [lieuOuvert, setLieuOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>('probleme');
  const [analyse, setAnalyse] = useState<{ enCours: boolean; texte: string | null }>({ enCours: false, texte: null });
  const [messages, setMessages] = useState<string[]>([]);
  const [aEssaye, setAEssaye] = useState(false);
  const [envoyeId, setEnvoyeId] = useState<string | null>(null);
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

  // La photo est jugée par le service d'analyse quand il est réglé ; la gravité suggérée n'écrase jamais un choix déjà fait et rien ne bloque.
  async function analyserPhoto(uri: string) {
    if (!analyseDisponible()) return;
    setAnalyse({ enCours: true, texte: null });
    try {
      const r = await jugerPhoto(uri);
      const g = graviteSuggeree(r);
      if (!r.valide) setAnalyse({ enCours: false, texte: MESSAGE_PHOTO_PAS_EGOUT });
      else if (g) {
        setGravite((avant) => avant ?? g);
        setAnalyse({ enCours: false, texte: `Gravité suggérée par l'analyse de la photo : ${LIBELLES_GRAVITE[g]}. Vous pouvez la changer.` });
      } else setAnalyse({ enCours: false, texte: null });
    } catch {
      setAnalyse({ enCours: false, texte: MESSAGE_ANALYSE_INDISPONIBLE });
    }
  }

  async function valider() {
    setMessages([]);
    setAEssaye(true);
    const invalides = erreursSignalement({ point, categorie, gravite, commentaire });
    if (!point || !categorie || !gravite || invalides.commentaire) return;
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
          onPhoto={(u) => setPhotoUri(u ?? null)}
          onBack={() => setEtape('probleme')}
          onSkip={() => setEtape('formulaire')}
          onContinue={() => {
            setEtape('formulaire');
            if (photoUri) void analyserPhoto(photoUri);
          }}
        />
      </View>
    );
  }

  const lieuConnu = point !== null;
  const adresseLieu = point ? lieuDeEndroit(point, chargerAdresses()) : null;

  // Étape 3 : derniers détails (résumé, lieu, importance, commentaire), puis l'envoi.
  return (
    <View style={styles.fond}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.enteteVert, { paddingTop: top + 14 }]}>
        <Pressable onPress={() => setEtape('photo')} accessibilityRole="button" accessibilityLabel="Retour à la photo" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
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

        <View style={styles.bloc}>
          <ThemedText style={styles.blocTitre} accessibilityRole="header">
            Importance
          </ThemedText>
          <View style={styles.troisColonnes}>
            {GRAVITES.map((g) => {
              const choisi = gravite === g;
              return (
                <Pressable
                  key={g}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: choisi }}
                  onPress={() => setGravite(g)}
                  style={[styles.importance, choisi && { borderColor: '#B84A0B', backgroundColor: '#FDE7D6' }]}>
                  <ThemedText style={[styles.importanceTexte, choisi && { fontWeight: '700', color: '#7A2F05' }]} maxFontSizeMultiplier={1.2}>
                    {LIBELLES_GRAVITE[g]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {erreursChamps.gravite && !gravite ? (
            <ThemedText type="small" accessibilityRole="alert" style={{ color: couleursTexte.erreur }}>
              {erreursChamps.gravite}
            </ThemedText>
          ) : null}
          {analyse.enCours ? (
            <View style={styles.suggestion} accessibilityLiveRegion="polite">
              <ThemedText style={styles.suggestionTexte}>Analyse de la photo…</ThemedText>
            </View>
          ) : analyse.texte ? (
            <View style={styles.suggestion} accessibilityLiveRegion="polite">
              <ThemedText style={styles.suggestionTexte}>{analyse.texte}</ThemedText>
            </View>
          ) : null}
        </View>

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
              <Bouton titre="Retirer la photo" variante="discret" onPress={() => { setPhotoUri(null); setAnalyse({ enCours: false, texte: null }); }} />
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: envoiEnCours }}
            disabled={envoiEnCours}
            onPress={() => void valider()}
            style={[styles.envoyer, envoiEnCours && { opacity: 0.6 }]}>
            <ThemedText style={styles.envoyerTexte} maxFontSizeMultiplier={1.2}>
              {envoiEnCours ? 'Envoi…' : 'Envoyer le signalement'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { minHeight: CIBLE_MIN, padding: 12, borderRadius: 12, justifyContent: 'center' },
  carte: { height: 240, borderRadius: 14 },
  enteteVert: { backgroundColor: '#1D3A1B', paddingHorizontal: 18, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  enteteTitre: { color: '#FFFFFF', fontSize: 26, lineHeight: 34, fontWeight: '700' },
  enteteSous: { color: '#DCE5CC', fontSize: 15, fontWeight: '500' },
  resume: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  vignette: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#DCE5CC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vignetteImage: { width: 64, height: 64 },
  resumeTitre: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  resumeLieu: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#5E5548' },
  changer: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: 4 },
  changerTexte: { fontSize: 15, fontWeight: '600', color: '#1D3A1B', textDecorationLine: 'underline' },
  lienLieu: { minHeight: 48, justifyContent: 'center' },
  bloc: { gap: 10 },
  blocTitre: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  troisColonnes: { flexDirection: 'row', gap: 10 },
  importance: { flex: 1, height: 56, borderRadius: 16, borderWidth: 2, borderColor: '#C9CFBD', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  importanceTexte: { fontSize: 15, fontWeight: '600' },
  suggestion: { backgroundColor: '#DCE5CC', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  suggestionTexte: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  pied: { paddingHorizontal: 20, paddingTop: 12 },
  envoyer: { height: 60, borderRadius: 30, backgroundColor: '#B84A0B', alignItems: 'center', justifyContent: 'center' },
  envoyerTexte: { color: '#FFFFFF', fontSize: 19, lineHeight: 26, fontWeight: '700' },
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
