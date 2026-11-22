import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text, ChampTexte as TextInput } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';


const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string) => COURRIEL.test(email.trim());

type Props = {
  /** Tente la connexion ; rend un message d'erreur lisible, ou null si elle a réussi. */
  onLogin: (email: string, password: string) => Promise<string | null>;
  /** Création de compte (non proposée au citoyen : le code reste, le parcours ne l'affiche pas). */
  onSignup?: () => void;
  onForgot: () => void;
  /** Entrée « Démonstration hors ligne » (seulement quand la base n'est pas joignable). */
  onDemo?: () => void;
  /** « Continuer sans compte » : signaler et suivre sans se connecter. */
  onGuest?: () => void;
  /** Message déjà connu (session expirée, par exemple). */
  notice?: string | null;
  /** Retour à la carte. */
  onBack?: () => void;
};

export default function LoginScreen({ onLogin, onSignup, onForgot, onDemo, onGuest, notice, onBack }: Props) {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!isValidEmail(email)) {
      setError("Entrez un courriel valide, par exemple nom@ville.ca.");
      return;
    }
    if (!password) {
      setError("Entrez votre mot de passe.");
      return;
    }
    setError(null);
    setBusy(true);
    const message = await onLogin(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  const champErreurEmail = !!error && !isValidEmail(email);
  const champErreurMdp = !!error && isValidEmail(email) && !password;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour à la carte" style={styles.retour}>
            <Ionicons name="arrow-back" size={28} color={P.onHeader} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            Connexion du personnel
          </Text>
          <Text style={styles.heroSous} maxFontSizeMultiplier={1.3}>
            Réservée aux équipes de la Ville.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.corps, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={28} color={P.primary} />
          <Text style={styles.noteTexte}>Pas besoin de compte pour signaler un problème : revenez à la carte.</Text>
        </View>

        <View style={styles.groupe}>
          <Text style={styles.etiquette}>Courriel</Text>
          <TextInput
            style={[styles.champ, champErreurEmail && styles.champErreur]}
            placeholder="prenom.nom@montreal.ca"
            placeholderTextColor={P.textSecondary}
            accessibilityLabel="Courriel"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
        </View>

        <View style={styles.groupe}>
          <Text style={styles.etiquette}>Mot de passe</Text>
          <View style={[styles.champLigne, champErreurMdp && styles.champErreur]}>
            <TextInput
              style={styles.champDedans}
              placeholder="Votre mot de passe"
              placeholderTextColor={P.textSecondary}
              accessibilityLabel="Mot de passe"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={styles.oeil}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color={P.text} />
            </Pressable>
          </View>
          <Pressable style={styles.forgot} onPress={onForgot} accessibilityRole="button">
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>
        </View>

        {notice && !error ? <Text style={styles.error}>{notice}</Text> : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={() => void handleLogin()} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }}>
          <Text style={styles.primaryText}>{busy ? "Connexion…" : "Se connecter"}</Text>
        </Pressable>

        {onSignup ? (
          <Pressable style={styles.secondary} onPress={onSignup} accessibilityRole="button">
            <Text style={styles.secondaryText}>Créer un compte</Text>
          </Pressable>
        ) : null}
        {onGuest ? (
          <Pressable style={styles.secondary} onPress={onGuest} accessibilityRole="button">
            <Text style={styles.secondaryText}>Continuer sans compte</Text>
          </Pressable>
        ) : null}

        {onDemo ? (
          <View style={styles.demo}>
            <Text style={styles.demoNote}>Visible seulement quand le serveur n&apos;est pas joignable</Text>
            <Pressable onPress={onDemo} accessibilityRole="button" style={styles.demoLien}>
              <Text style={styles.forgotText}>Démonstration hors ligne (simulée)</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: { flex: 1, backgroundColor: P.background },
  hero: { backgroundColor: P.header, paddingHorizontal: 18, paddingBottom: 26, flexDirection: "row", alignItems: "center", gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  heroTitre: { color: P.onHeader, fontSize: 26, fontWeight: "700" },
  heroSous: { color: P.bandeau, fontSize: 15, fontWeight: "500" },
  corps: { padding: 24, gap: 20, flexGrow: 1 },
  note: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: P.bandeau, borderRadius: 20, padding: 16 },
  noteTexte: { flex: 1, fontSize: 14, fontWeight: "500", color: P.text, lineHeight: 20 },
  groupe: { gap: 8 },
  etiquette: { fontSize: 15, fontWeight: "600", color: P.text },
  champ: { minHeight: 54, borderWidth: 2, borderColor: P.borderForte, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, backgroundColor: P.surface, color: P.text },
  champLigne: { minHeight: 54, borderWidth: 2, borderColor: P.borderForte, borderRadius: 16, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", paddingLeft: 16 },
  champDedans: { flex: 1, fontSize: 16, color: P.text, minHeight: 50 },
  champErreur: { borderColor: P.danger },
  oeil: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  forgot: { alignSelf: "flex-end", minHeight: 48, justifyContent: "center" },
  forgotText: { fontSize: 15, fontWeight: "600", color: P.primary, textDecorationLine: "underline" },
  error: { color: P.danger, fontSize: 14, fontWeight: "600" },
  primary: { height: 60, borderRadius: 30, backgroundColor: P.action, alignItems: "center", justifyContent: "center" },
  primaryText: { color: P.onAction, fontSize: 19, fontWeight: "700" },
  secondary: { minHeight: 52, borderRadius: 26, borderWidth: 2, borderColor: P.primary, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: P.primary, fontSize: 16, fontWeight: "700" },
  demo: { borderTopWidth: 1, borderTopColor: P.border, paddingTop: 16, alignItems: "center", gap: 6, marginTop: 8 },
  demoNote: { fontSize: 13, fontWeight: "500", color: P.textSecondary, textAlign: "center" },
  demoLien: { minHeight: 48, justifyContent: "center" },
});
