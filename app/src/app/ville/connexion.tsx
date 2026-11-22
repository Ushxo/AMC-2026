import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { useCouleursTexte } from '@/components/ville/couleurs';
import { Lien } from '@/components/ville/lien';
import { CIBLE_MIN } from '@/components/ville/style';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';

export default function Connexion() {
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const couleurs = useCouleursTexte();
  const { etat } = useSource();
  const { employe, connecter, entrerDemoHorsLigne, avertissement } = useSessionEmploye();
  const repli = etat === 'repli';
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (employe) return <Redirect href="/ville" />;

  const champ = [styles.champ, { backgroundColor: theme.backgroundElement, color: theme.text }];

  async function valider() {
    if (!courriel.trim() || !motDePasse) {
      setErreur('Entrez votre courriel et votre mot de passe.');
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
            <TextInput
              style={champ}
              value={courriel}
              onChangeText={setCourriel}
              placeholder="Courriel"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Courriel"
            />
            <TextInput
              style={champ}
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder="Mot de passe"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              textContentType="password"
              accessibilityLabel="Mot de passe"
              onSubmitEditing={valider}
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
  contenu: { padding: 24, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  champ: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  demo: { gap: 8, marginTop: 8 },
});
