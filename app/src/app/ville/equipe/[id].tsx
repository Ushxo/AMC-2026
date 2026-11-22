import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

export default function FicheEquipe() {
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { equipes, modifier, desactiver, lectureSeule, chargement, erreur, rafraichir } = useEquipes();
  const { etat } = useSource();
  const { resultat } = useTournees();
  const { peutGerer } = useSessionEmploye();
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
              <ThemedText type="subtitle" accessibilityRole="header">
                {equipe.nom}
              </ThemedText>
              {lectureSeule ? <ThemedText type="small">{MESSAGE_EQUIPES_LECTURE_SEULE}</ThemedText> : null}
              <ThemedText type="smallBold" accessibilityRole="header">
                Tournée prévue
              </ThemedText>
              {tournee ? (
                <>
                  <ThemedText>
                    {tournee.arrets.length} arrêts, {formaterKm(tournee.distance_m)}, {formaterDuree(tournee.duree_s)} de
                    travail
                  </ThemedText>
                  {tournee.arrets.map((a) => (
                    <ThemedText key={a.rang} type="small">
                      {a.rang}. {formaterHeure(a.arrivee_prevue)} · {a.signalement_ids.length} signalement
                      {a.signalement_ids.length > 1 ? 's' : ''}
                    </ThemedText>
                  ))}
                </>
              ) : (
                <ThemedText themeColor="textSecondary">Pas de tournée pour cette équipe.</ThemedText>
              )}
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
          <Bouton titre="Retour" variante="discret" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
});
