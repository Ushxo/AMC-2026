import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { useCouleursTexte } from '@/components/ville/couleurs';
import { Lien } from '@/components/ville/lien';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { erreursConnexion, type ErreursChamps } from '@/lib/champs';

export default function Connexion() {
  const { bottom } = useSafeAreaInsets();
  const couleurs = useCouleursTexte();
  const { etat } = useSource();
  const { employe, connecter, entrerDemoHorsLigne, avertissement } = useSessionEmploye();
  const repli = etat === 'repli';
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<ErreursChamps>({});
  const [enCours, setEnCours] = useState(false);

  if (employe) return <Redirect href="/ville" />;

  async function valider() {
    const invalides = erreursConnexion({ courriel, motDePasse });
    setErreurs(invalides);
    if (Object.keys(invalides).length > 0) {
      setErreur(null);
      return;
    }
    setEnCours(true);
    setErreur(await connecter(courriel, motDePasse));
    setEnCours(false);
  }

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={['top']}>
        <View style={styles.fond}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" accessibilityRole="header">
              Mode Ville
            </ThemedText>
            <ThemedText themeColor="textSecondary">Connexion réservée aux employés de la Ville.</ThemedText>
            <BandeauSource etat={etat} />
            <Champ
              etiquette="Courriel"
              value={courriel}
              onChangeText={setCourriel}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              erreur={erreurs.courriel}
            />
            <Champ
              etiquette="Mot de passe"
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              textContentType="password"
              onSubmitEditing={valider}
              erreur={erreurs.motDePasse}
            />
            {avertissement && !erreur ? (
              <ThemedText accessibilityRole="alert" style={{ color: couleurs.erreur }}>
                {avertissement}
              </ThemedText>
            ) : null}
            {erreur ? (
              <ThemedText accessibilityRole="alert" style={{ color: couleurs.erreur }}>
                {erreur}
              </ThemedText>
            ) : null}
            <Bouton titre={enCours ? 'Connexion…' : 'Se connecter'} pleineLargeur onPress={valider} actif={!enCours} />
            {repli ? (
              <View style={styles.demo}>
                <ThemedText type="small" themeColor="textSecondary">
                  Pas de connexion à la base de la Ville. Vous pouvez ouvrir une démonstration simulée : rien n&apos;est
                  envoyé et les changements restent sur cet appareil.
                </ThemedText>
                <Bouton titre="Démonstration hors ligne (simulée)" variante="discret" onPress={entrerDemoHorsLigne} />
              </View>
            ) : null}
            <Lien href="/ville/inscription" titre="Créer un compte" />
            <Lien href="/" titre="Retour au mode citoyen" />
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 24, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demo: { gap: 8, marginTop: 8 },
});
