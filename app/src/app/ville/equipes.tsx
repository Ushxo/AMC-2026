import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { ChoixAdresse } from '@/components/ville/choix-adresse';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { couleurEquipe, BLANC_FIXE } from '@/components/ville/style';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { erreursEquipe, type ErreursChamps } from '@/lib/champs';
import { ETIQUETTE_DEMONSTRATION, MESSAGE_AUCUNE_EQUIPE, MESSAGE_EQUIPES_LECTURE_SEULE, MESSAGE_HYPOTHESES_DEMO } from '@/lib/messages';
import type { Coordonnees } from '@/types';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

/** Route classique. */
export default function Equipes() {
  return <EcranEquipes />;
}

export function EcranEquipes({ dansCoquille = false }: { dansCoquille?: boolean }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { bottom: bas } = useSafeAreaInsets();
  const bottom = dansCoquille ? 0 : bas;
  const router = useRouter();
  const { etat } = useSource();
  const { demoHorsLigne, peutGerer } = useSessionEmploye();
  const { equipes, creer, lectureSeule, chargement, erreur, rafraichir } = useEquipes();
  const [nom, setNom] = useState('');
  const [vehicule, setVehicule] = useState('');
  const [debut, setDebut] = useState('07:00');
  const [fin, setFin] = useState('14:00');
  const [garage, setGarage] = useState<Coordonnees | null>(null);
  const [garageAdresse, setGarageAdresse] = useState<string | null>(null);
  const [erreurGarage, setErreurGarage] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<ErreursChamps>({});
  const [message, setMessage] = useState<string | null>(null);

  async function ajouter() {
    const invalides = erreursEquipe({ nom, debut, fin });
    setErreurs(invalides);
    setErreurGarage(garage ? null : 'Choisissez le garage : touchez la carte ou utilisez votre position.');
    if (Object.keys(invalides).length > 0 || !garage) return;
    const r = await creer({
      nom,
      membres: [],
      vehicule: vehicule.trim() || null,
      garage,
      garage_adresse: garageAdresse,
      debut_quart: debut,
      fin_quart: fin,
    });
    setMessage(r ?? 'Équipe ajoutée.');
    if (!r) setNom('');
  }

  const actives = equipes.filter((e) => e.active);

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
          keyboardShouldPersistTaps="handled">
          <BandeauSource etat={etat} simule={demoHorsLigne} />
          {lectureSeule ? <ThemedText type="small">{MESSAGE_EQUIPES_LECTURE_SEULE}</ThemedText> : null}
          {chargement ? (
            <Chargement />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : actives.length === 0 ? (
            <Vide texte={MESSAGE_AUCUNE_EQUIPE} />
          ) : (
            actives.map((e, i) => {
              const arrivee = e.arrivee ? 'autre adresse' : 'garage';
              const depart = e.garage_nom ?? e.garage_adresse ?? 'garage';
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.nom}, quart de ${e.debut_quart} à ${e.fin_quart}, départ ${depart}, arrivée ${arrivee}, ${e.compte_id ? 'compte associé' : 'aucun compte associé'}. Ouvrir.`}
                  onPress={() => router.push({ pathname: '/ville/equipe/[id]', params: { id: e.id } })}
                  style={styles.carteEquipe}>
                  <View style={[styles.numero, { backgroundColor: couleurEquipe(i) }]}>
                    <ThemedText style={styles.numeroTexte}>{i + 1}</ThemedText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={styles.equipeNom}>{e.nom}</ThemedText>
                    <ThemedText style={styles.equipeDetail}>
                      Départ : {depart} · Arrivée : {arrivee}
                    </ThemedText>
                    <ThemedText style={styles.equipeDetail}>
                      Quart de {e.debut_quart} à {e.fin_quart}
                      {e.vehicule ? ` · ${e.vehicule}` : ''}
                    </ThemedText>
                    <ThemedText style={styles.equipeCompte}>
                      {e.compte_id ? 'Compte associé' : 'Aucun compte associé'}
                      {e.exemple_demo ? ` · ${ETIQUETTE_DEMONSTRATION}` : ''}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={P.text} />
                </Pressable>
              );
            })
          )}
          {!lectureSeule && peutGerer ? (
            <View style={styles.formulaire}>
              <ThemedText type="smallBold" accessibilityRole="header">
                Nouvelle équipe
              </ThemedText>
              <Champ etiquette="Nom de l'équipe" value={nom} onChangeText={setNom} maxLength={60} erreur={erreurs.nom} />
              <Champ etiquette="Véhicule (facultatif)" value={vehicule} onChangeText={setVehicule} />
              <Champ etiquette="Début du quart (HH:MM)" value={debut} onChangeText={setDebut} keyboardType="numbers-and-punctuation" erreur={erreurs.debut} />
              <Champ etiquette="Fin du quart (HH:MM)" value={fin} onChangeText={setFin} keyboardType="numbers-and-punctuation" erreur={erreurs.fin} />
              <ChoixAdresse
                titre="Adresse de départ (garage)"
                point={garage}
                adresse={garageAdresse}
                onChoisir={(a) => {
                  setGarage(a.position);
                  setGarageAdresse(a.adresse);
                  setErreurGarage(null);
                }}
                erreur={erreurGarage}
              />
              {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
              <Bouton titre="Ajouter l'équipe" pleineLargeur onPress={() => void ajouter()} />
            </View>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {MESSAGE_HYPOTHESES_DEMO}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  carteEquipe: { backgroundColor: P.surface, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 80 },
  numero: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  numeroTexte: { color: BLANC_FIXE, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  equipeNom: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  equipeDetail: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: P.textSecondary },
  equipeCompte: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: P.primary },
  formulaire: { gap: 10, marginTop: 8 },
});
