import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Champ } from '@/components/ville/champ';
import { erreursInscription, type ErreursChamps } from '@/lib/champs';
import { useCouleursTexte } from '@/components/ville/couleurs';
import { Lien } from '@/components/ville/lien';
import { useSource } from '@/hooks/use-source';
import { creerCompte, MOT_DE_PASSE_MIN } from '@/lib/auth';

export default function Inscription() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const couleurs = useCouleursTexte();
  const { etat } = useSource();
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ ok: boolean; message: string } | null>(null);

  const [erreurs, setErreurs] = useState<ErreursChamps>({});

  async function valider() {
    const invalides = erreursInscription({ courriel, motDePasse });
    setErreurs(invalides);
    if (Object.keys(invalides).length > 0) return;
    setEnCours(true);
    setResultat(null);
    const r = await creerCompte(courriel, motDePasse, prenom, nom);
    setResultat({ ok: r.statut !== 'erreur', message: r.message });
    setEnCours(false);
  }

  const cree = resultat?.ok === true;

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
              Créer un compte
            </ThemedText>
            <BandeauSource etat={etat} />
            {cree ? (
              <>
                <ThemedText accessibilityRole="alert">{resultat.message}</ThemedText>
                <Bouton titre="Retour à la connexion" onPress={() => router.replace('/ville/connexion')} />
              </>
            ) : (
              <>
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
                  etiquette={`Mot de passe (${MOT_DE_PASSE_MIN} caractères au moins)`}
                  value={motDePasse}
                  onChangeText={setMotDePasse}
                  secureTextEntry={!afficher}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  erreur={erreurs.motDePasse}
                />
                <Bouton
                  titre={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  variante="discret"
                  onPress={() => setAfficher(!afficher)}
                />
                <Champ etiquette="Prénom (facultatif)" value={prenom} onChangeText={setPrenom} textContentType="givenName" />
                <Champ etiquette="Nom (facultatif)" value={nom} onChangeText={setNom} textContentType="familyName" />
                {resultat ? (
                  <ThemedText accessibilityRole="alert" style={{ color: couleurs.erreur }}>
                    {resultat.message}
                  </ThemedText>
                ) : null}
                <Bouton titre={enCours ? 'Création…' : 'Créer mon compte'} pleineLargeur onPress={() => void valider()} actif={!enCours} />
                <Lien href="/ville/connexion" titre="J'ai déjà un compte : me connecter" />
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 24, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
});
