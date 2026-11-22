import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EnteteVert } from '../../../../frontend/components/EnteteVert';
import { usePositionsEquipes } from '@/hooks/use-positions-equipes';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { ChoixAdresse, type AdresseChoisie } from '@/components/ville/choix-adresse';
import { erreursCourrielCompte, erreursEquipe, type ErreursChamps } from '@/lib/champs';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useTournees } from '@/hooks/use-tournees';
import { associerCompte, dissocierCompte } from '@/lib/equipe-compte';
import {
  MESSAGE_COMPTE_ASSOCIE,
  MESSAGE_COMPTE_RAPPEL,
  MESSAGE_COMPTE_RETIRE,
  MESSAGE_EQUIPES_LECTURE_SEULE,
} from '@/lib/messages';
import { formaterDuree, formaterHeure, formaterKm } from '@/lib/temps';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

export default function FicheEquipe() {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { equipes, modifier, desactiver, lectureSeule, chargement, erreur, rafraichir } = useEquipes();
  const { etat } = useSource();
  const { resultat } = useTournees();
  const { peutGerer } = useSessionEmploye();
  const { positions } = usePositionsEquipes(peutGerer);
  const maj = positions.find((p) => p.equipe_id === id)?.maj_le;
  // « position vue il y a N min » : lu une fois au rendu (l'heure change peu pendant l'écran).
  const [maintenant] = useState(() => Date.now());
  const positionVue = maj ? `position vue il y a ${Math.max(0, Math.round((maintenant - Date.parse(maj)) / 60000))} min` : null;
  const equipe = useMemo(() => equipes.find((e) => e.id === id), [equipes, id]);
  const tournee = useMemo(() => resultat?.tournees.find((t) => t.equipe_id === id), [resultat, id]);
  const [nom, setNom] = useState('');
  const [vehicule, setVehicule] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [courriel, setCourriel] = useState('');
  const [messageCompte, setMessageCompte] = useState<string | null>(null);
  const [depart, setDepart] = useState<AdresseChoisie | null>(null);
  const [memeAdresse, setMemeAdresse] = useState(true);
  const [arrivee, setArrivee] = useState<AdresseChoisie | null>(null);
  const [adressesModifiees, setAdressesModifiees] = useState(false);

  useEffect(() => {
    if (!equipe) return;
    const t = setTimeout(() => {
      setNom(equipe.nom);
      setVehicule(equipe.vehicule ?? '');
      setDebut(equipe.debut_quart);
      setFin(equipe.fin_quart);
      setDepart({ position: equipe.garage, adresse: equipe.garage_adresse ?? null });
      setMemeAdresse(!equipe.arrivee);
      setArrivee(equipe.arrivee ? { position: equipe.arrivee, adresse: equipe.arrivee_adresse ?? null } : null);
    }, 0);
    return () => clearTimeout(t);
  }, [equipe]);

  const [erreurs, setErreurs] = useState<ErreursChamps>({});
  const [erreurArrivee, setErreurArrivee] = useState<string | null>(null);
  const [erreursCompte, setErreursCompte] = useState<ErreursChamps>({});

  async function enregistrer() {
    const invalides = erreursEquipe({ nom, debut, fin });
    setErreurs(invalides);
    if (Object.keys(invalides).length > 0) return;
    if (!memeAdresse && !arrivee) {
      setErreurArrivee("Choisissez l'adresse d'arrivée, ou gardez « Même adresse que le départ ».");
      return;
    }
    setErreurArrivee(null);
    const r = await modifier(id, {
      nom,
      vehicule: vehicule.trim() || null,
      debut_quart: debut,
      fin_quart: fin,
      // Les adresses ne sont envoyées que si on les a changées (la migration 0007 peut ne pas être lancée).
      ...(adressesModifiees && depart ? { garage: depart.position, garage_adresse: depart.adresse } : {}),
      ...(adressesModifiees
        ? memeAdresse
          ? { arrivee: null, arrivee_adresse: null, arrivee_nom: null }
          : { arrivee: arrivee?.position ?? null, arrivee_adresse: arrivee?.adresse ?? null }
        : {}),
    });
    setMessage(r ?? 'Équipe enregistrée.');
  }

  async function associer() {
    const invalides = erreursCourrielCompte(courriel);
    setErreursCompte(invalides);
    if (Object.keys(invalides).length > 0) return;
    const r = await associerCompte(courriel, id);
    if (r) {
      setMessageCompte(r);
      return;
    }
    setCourriel('');
    setMessageCompte(MESSAGE_COMPTE_ASSOCIE);
    await rafraichir();
  }

  async function retirerCompte() {
    const r = await dissocierCompte(id);
    setMessageCompte(r ?? MESSAGE_COMPTE_RETIRE);
    if (!r) await rafraichir();
  }

  async function retirer() {
    const r = await desactiver(id);
    if (r) setMessage(r);
    else router.back();
  }

  return (
    <ThemedView style={styles.fond}>
      <Stack.Screen options={{ headerShown: false }} />
      <EnteteVert titre={equipe?.nom ?? 'Équipe'} sousTitre={equipe ? (equipe.active ? "En service aujourd'hui" : 'Hors service') : undefined} onBack={() => router.back()} libelleRetour="Retour aux équipes" />
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
          keyboardShouldPersistTaps="handled">
          {chargement ? (
            <Chargement />
          ) : erreur ? (
            <Erreur message={erreur} />
          ) : !equipe ? (
            <Vide texte="Cette équipe est introuvable." />
          ) : (
            <>
              {lectureSeule ? <ThemedText type="small">{MESSAGE_EQUIPES_LECTURE_SEULE}</ThemedText> : null}
              <View style={styles.carte}>
                <View style={styles.lieuLigne}>
                  <View style={[styles.rond, { backgroundColor: P.primary }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.legende}>Départ</ThemedText>
                    <ThemedText style={styles.valeur}>Garage de l&apos;équipe</ThemedText>
                    <ThemedText style={styles.detail}>{equipe.garage_adresse ?? equipe.garage_nom ?? 'Adresse non indiquée'}</ThemedText>
                  </View>
                </View>
                <View style={styles.lieuLigne}>
                  <View style={[styles.rond, { backgroundColor: P.action }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.legende}>Arrivée</ThemedText>
                    <ThemedText style={styles.valeur}>{equipe.arrivee ? 'Autre adresse' : 'Retour au garage'}</ThemedText>
                    <ThemedText style={styles.detail}>{equipe.arrivee ? (equipe.arrivee_adresse ?? 'Adresse choisie') : 'Ou une autre adresse, ou fin libre (à modifier plus bas)'}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.detail}>
                  Quart de {equipe.debut_quart} à {equipe.fin_quart}
                  {equipe.vehicule ? ` · ${equipe.vehicule}` : ''}
                </ThemedText>
              </View>

              <View style={styles.carte}>
                <ThemedText style={styles.titreCarte} accessibilityRole="header">
                  Compte de l&apos;équipe
                </ThemedText>
                <ThemedText style={styles.valeur}>{equipe.compte_id ? 'Compte associé' : 'Aucun compte associé'}</ThemedText>
                <ThemedText style={styles.detail}>Ce compte voit « Ma carte » et valide les arrêts.</ThemedText>
                {!lectureSeule && peutGerer && equipe.compte_id ? (
                  <Bouton titre="Retirer ce compte" variante="discret" onPress={() => void retirerCompte()} />
                ) : null}
              </View>

              <View style={styles.carteVerte}>
                <View style={styles.lieuLigne}>
                  <ThemedText style={[styles.titreCarte, { flex: 1, color: P.primary }]} accessibilityRole="header">
                    Trajet du jour
                  </ThemedText>
                  {tournee ? <ThemedText style={styles.pastille}>{formaterDuree(tournee.duree_s)}</ThemedText> : null}
                </View>
                {tournee ? (
                  <>
                    <ThemedText style={styles.detail}>
                      {tournee.arrets.length} arrêts, dont {tournee.arrets.filter((a) => a.fait).length} faits · {formaterKm(tournee.distance_m)}
                      {positionVue ? ` · ${positionVue}` : ''}
                    </ThemedText>
                    <View style={styles.piste} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: tournee.arrets.length, now: tournee.arrets.filter((a) => a.fait).length }}>
                      <View style={[styles.remplissage, { width: `${tournee.arrets.length > 0 ? Math.round((tournee.arrets.filter((a) => a.fait).length / tournee.arrets.length) * 100) : 0}%` }]} />
                    </View>
                    {tournee.arrets.map((a) => (
                      <ThemedText key={a.rang} type="small">
                        {a.rang}. {formaterHeure(a.arrivee_prevue)} · {a.signalement_ids.length} signalement
                        {a.signalement_ids.length > 1 ? 's' : ''}
                      </ThemedText>
                    ))}
                  </>
                ) : (
                  <ThemedText style={styles.detail}>Pas de tournée pour cette équipe.</ThemedText>
                )}
              </View>
              {!lectureSeule && peutGerer ? (
                <>
                  <ThemedText type="smallBold" accessibilityRole="header">
                    Modifier
                  </ThemedText>
                  <Champ etiquette="Nom de l'équipe" value={nom} onChangeText={setNom} maxLength={60} erreur={erreurs.nom} />
                  <Champ etiquette="Véhicule" value={vehicule} onChangeText={setVehicule} />
                  <Champ etiquette="Début du quart (HH:MM)" value={debut} onChangeText={setDebut} erreur={erreurs.debut} />
                  <Champ etiquette="Fin du quart (HH:MM)" value={fin} onChangeText={setFin} erreur={erreurs.fin} />
                  <ChoixAdresse
                    titre="Adresse de départ (garage)"
                    point={depart?.position ?? null}
                    adresse={depart?.adresse ?? null}
                    onChoisir={(a) => {
                      setDepart(a);
                      setAdressesModifiees(true);
                    }}
                  />
                  <ThemedText type="smallBold" accessibilityRole="header">
                    Adresse d&apos;arrivée
                  </ThemedText>
                  <Bouton
                    titre="Même adresse que le départ"
                    variante="discret"
                    selectionne={memeAdresse}
                    onPress={() => {
                      setMemeAdresse(true);
                      setAdressesModifiees(true);
                      setErreurArrivee(null);
                    }}
                  />
                  <Bouton
                    titre="Choisir une autre adresse d'arrivée"
                    variante="discret"
                    selectionne={!memeAdresse}
                    onPress={() => {
                      setMemeAdresse(false);
                      setAdressesModifiees(true);
                    }}
                  />
                  {!memeAdresse ? (
                    <ChoixAdresse
                      titre="Adresse d'arrivée"
                      point={arrivee?.position ?? null}
                      adresse={arrivee?.adresse ?? null}
                      onChoisir={(a) => {
                        setArrivee(a);
                        setAdressesModifiees(true);
                        setErreurArrivee(null);
                      }}
                      erreur={erreurArrivee}
                    />
                  ) : null}
                  {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
                  <Bouton titre="Enregistrer" pleineLargeur onPress={() => void enregistrer()} />
                  <Bouton titre="Désactiver l'équipe" variante="discret" onPress={() => void retirer()} />
                  <ThemedText type="smallBold" accessibilityRole="header">
                    Compte de l&apos;équipe
                  </ThemedText>
                  {etat === 'repli' ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Disponible en ligne seulement.
                    </ThemedText>
                  ) : (
                    <>
                      <ThemedText type="small" themeColor="textSecondary">
                        {equipe.compte_id ? 'Un compte suit le trajet de cette équipe.' : 'Aucun compte associé.'}{' '}
                        {MESSAGE_COMPTE_RAPPEL}
                      </ThemedText>
                      <Champ
                        etiquette="Courriel du compte de l'équipe"
                        value={courriel}
                        onChangeText={setCourriel}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        erreur={erreursCompte.courriel}
                      />
                      {messageCompte ? <ThemedText accessibilityRole="alert">{messageCompte}</ThemedText> : null}
                      <Bouton titre="Associer ce compte" pleineLargeur onPress={() => void associer()} />
                      {equipe.compte_id ? (
                        <Bouton titre="Retirer le compte" variante="discret" onPress={() => void retirerCompte()} />
                      ) : null}
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
        {equipe && tournee ? (
          <View style={[styles.pied, { paddingBottom: bottom + 12 }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/ville/trajet/[equipe]', params: { equipe: equipe.id } })}
              style={styles.suivre}>
              <ThemedText style={styles.suivreTexte} maxFontSizeMultiplier={1.2}>
                Suivre ce trajet
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  carte: { backgroundColor: P.surface, borderRadius: 22, padding: 18, gap: 10 },
  carteVerte: { backgroundColor: P.bandeau, borderRadius: 22, padding: 18, gap: 10 },
  lieuLigne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rond: { width: 14, height: 14, borderRadius: 7 },
  legende: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: P.textSecondary },
  valeur: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: P.textSecondary },
  titreCarte: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  pastille: { backgroundColor: P.surface, color: P.primary, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  piste: { height: 8, borderRadius: 4, backgroundColor: P.surface, overflow: 'hidden' },
  remplissage: { height: 8, borderRadius: 4, backgroundColor: P.primary },
  pied: { paddingHorizontal: 20, paddingTop: 8 },
  suivre: { height: 60, borderRadius: 30, backgroundColor: P.action, alignItems: 'center', justifyContent: 'center' },
  suivreTexte: { color: P.onAction, fontSize: 19, lineHeight: 26, fontWeight: '700' },
});
