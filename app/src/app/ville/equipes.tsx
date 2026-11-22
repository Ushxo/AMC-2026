import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { ChoixAdresse } from '@/components/ville/choix-adresse';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteNeutre } from '@/components/ville/etiquette';
import { CIBLE_MIN } from '@/components/ville/style';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { erreursEquipe, type ErreursChamps } from '@/lib/champs';
import { ETIQUETTE_DEMONSTRATION, MESSAGE_AUCUNE_EQUIPE, MESSAGE_EQUIPES_LECTURE_SEULE, MESSAGE_HYPOTHESES_DEMO } from '@/lib/messages';
import type { Coordonnees } from '@/types';

export default function Equipes() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
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
            actives.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`${e.nom}, quart de ${e.debut_quart} à ${e.fin_quart}. Ouvrir.`}
                onPress={() => router.push({ pathname: '/ville/equipe/[id]', params: { id: e.id } })}
                style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{e.nom}</ThemedText>
                <ThemedText type="small">
                  Quart de {e.debut_quart} à {e.fin_quart}
                  {e.vehicule ? ` · ${e.vehicule}` : ''}
                </ThemedText>
                {e.garage_nom ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Garage : {e.garage_nom}
                    {e.exemple_demo ? ' (simulé)' : ''}
                  </ThemedText>
                ) : null}
                {e.exemple_demo ? <EtiquetteNeutre texte={ETIQUETTE_DEMONSTRATION} /> : null}
              </Pressable>
            ))
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

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  ligne: { minHeight: CIBLE_MIN, padding: 14, borderRadius: 14, gap: 4 },
  formulaire: { gap: 10, marginTop: 8 },
});
