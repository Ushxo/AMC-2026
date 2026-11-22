import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useTournees } from '@/hooks/use-tournees';
import { MESSAGE_EQUIPES_LECTURE_SEULE } from '@/lib/messages';
import { formaterDuree, formaterHeure, formaterKm } from '@/lib/temps';

export default function FicheEquipe() {
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { equipes, modifier, desactiver, lectureSeule, chargement, erreur } = useEquipes();
  const { resultat } = useTournees();
  const { peutGerer } = useSessionEmploye();
  const equipe = useMemo(() => equipes.find((e) => e.id === id), [equipes, id]);
  const tournee = useMemo(() => resultat?.tournees.find((t) => t.equipe_id === id), [resultat, id]);
  const [nom, setNom] = useState('');
  const [vehicule, setVehicule] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!equipe) return;
    const t = setTimeout(() => {
      setNom(equipe.nom);
      setVehicule(equipe.vehicule ?? '');
      setDebut(equipe.debut_quart);
      setFin(equipe.fin_quart);
    }, 0);
    return () => clearTimeout(t);
  }, [equipe]);

  async function enregistrer() {
    const r = await modifier(id, { nom, vehicule: vehicule.trim() || null, debut_quart: debut, fin_quart: fin });
    setMessage(r ?? 'Équipe enregistrée.');
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
                  <Champ etiquette="Nom de l'équipe" value={nom} onChangeText={setNom} maxLength={60} />
                  <Champ etiquette="Véhicule" value={vehicule} onChangeText={setVehicule} />
                  <Champ etiquette="Début du quart (HH:MM)" value={debut} onChangeText={setDebut} />
                  <Champ etiquette="Fin du quart (HH:MM)" value={fin} onChangeText={setFin} />
                  {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
                  <Bouton titre="Enregistrer" pleineLargeur onPress={() => void enregistrer()} />
                  <Bouton titre="Désactiver l'équipe" variante="discret" onPress={() => void retirer()} />
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
