import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { CIBLE_MIN, COULEUR_OMBRE } from '@/components/ville/style';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { erreursEquipe, type ErreursChamps } from '@/lib/champs';
import { ETIQUETTE_DEMONSTRATION, MESSAGE_AUCUNE_EQUIPE, MESSAGE_EQUIPES_LECTURE_SEULE, MESSAGE_HYPOTHESES_DEMO } from '@/lib/messages';
import type { Coordonnees } from '@/types';

/** Route classique. */
export default function Equipes() {
  return <EcranEquipes />;
}

export function EcranEquipes({ dansCoquille = false }: { dansCoquille?: boolean }) {
  const { bottom: bas } = useSafeAreaInsets();
  const bottom = dansCoquille ? 0 : bas;
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

          <View style={styles.entete}>
            <View style={{ flex: 1 }}>
              <ThemedText type="title" accessibilityRole="header" style={styles.titre}>
                Équipes
              </ThemedText>
              <ThemedText themeColor="textSecondary">Les équipes actives et leur quart de travail.</ThemedText>
            </View>
            {!chargement && !erreur ? (
              <View style={[styles.compteur, { backgroundColor: theme.accent + '22' }]}>
                <ThemedText type="smallBold" style={[styles.compteurTexte, { color: theme.text }]}>
                  {actives.length} active{actives.length > 1 ? 's' : ''}
                </ThemedText>
              </View>
            ) : null}
          </View>

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
                accessibilityLabel={`${e.nom}, quart de ${e.debut_quart} à ${e.fin_quart}, ${e.compte_id ? 'compte associé' : 'aucun compte associé'}. Ouvrir.`}
                onPress={() => router.push({ pathname: '/ville/equipe/[id]', params: { id: e.id } })}
                style={({ pressed }) => [
                  styles.carte,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                ]}>
                <View style={styles.carteHaut}>
                  <View style={[styles.avatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <ThemedText style={[styles.initiales, { color: theme.primary }]}>{initiales(e.nom)}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.nom} numberOfLines={2}>
                      {e.nom}
                    </ThemedText>
                    {e.exemple_demo ? <EtiquetteNeutre texte={ETIQUETTE_DEMONSTRATION} /> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
                </View>

                <View style={styles.puces}>
                  <View style={styles.puce}>
                    <Ionicons name="time-outline" size={16} color={theme.primary} />
                    <ThemedText style={styles.puceTexte}>
                      {e.debut_quart} – {e.fin_quart}
                    </ThemedText>
                  </View>
                  {e.vehicule ? (
                    <View style={styles.puce}>
                      <MaterialCommunityIcons name="truck-outline" size={16} color={theme.primary} />
                      <ThemedText style={styles.puceTexte} numberOfLines={1}>
                        {e.vehicule}
                      </ThemedText>
                    </View>
                  ) : null}
                  <View style={styles.puce}>
                    <Ionicons name={e.compte_id ? 'person-outline' : 'person-remove-outline'} size={16} color={theme.primary} />
                    <ThemedText style={styles.puceTexte} numberOfLines={1}>
                      {e.compte_id ? 'Compte associé' : 'Aucun compte'}
                    </ThemedText>
                  </View>
                </View>

                {e.garage_nom ? (
                  <View style={[styles.garage, { borderTopColor: theme.border }]}>
                    <Ionicons name="location" size={16} color={theme.accent} />
                    <ThemedText themeColor="textSecondary" style={styles.garageTexte}>
                      Garage : {e.garage_nom}
                      {e.exemple_demo ? ' (simulé)' : ''}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ))
          )}
          {!lectureSeule && peutGerer ? (
            <View style={[styles.formulaire, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.formulaireEntete}>
                <View style={[styles.formulaireIcone, { backgroundColor: theme.accent + '22' }]}>
                  <Ionicons name="people" size={24} color={theme.accent} />
                </View>
                <ThemedText type="subtitle" accessibilityRole="header" style={styles.formulaireTitre}>
                  Nouvelle équipe
                </ThemedText>
              </View>
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

/** « Équipe A » → « A » ; « Voirie Nord » → « VN ». */
function initiales(nom: string): string {
  const mots = nom.replace(/^équipe\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : (mots[0] ?? '?').slice(0, 2)).toUpperCase();
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 20, gap: 16, maxWidth: 800, width: '100%', alignSelf: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  titre: { fontSize: 34, lineHeight: 40 },
  compteur: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  compteurTexte: { fontSize: 15 },
  carte: {
    minHeight: CIBLE_MIN,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    shadowColor: COULEUR_OMBRE,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  initiales: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  nom: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  puce: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, maxWidth: '100%' },
  puceTexte: { fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  garage: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1 },
  garageTexte: { flex: 1, fontSize: 13, lineHeight: 18 },
  formulaire: { gap: 12, marginTop: 8, padding: 18, borderRadius: 24, borderWidth: 1 },
  formulaireEntete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  formulaireIcone: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formulaireTitre: { fontSize: 24, lineHeight: 30 },
});
