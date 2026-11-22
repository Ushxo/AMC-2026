import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";
import { AppLogo } from "../components/AppLogo";

// Couleurs : les jetons du thème (constants/theme.ts), jamais des hex locaux.
const C = {
  green: Palette.header,
  cream: Palette.onHeader,
  orange: Palette.accent,
  border: Palette.border,
  text: Palette.text,
  muted: Palette.textSecondary,
  white: Palette.surface,
  error: Palette.danger,
};

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string) => COURRIEL.test(email.trim());

type Props = {
  /** Tente la connexion ; rend un message d'erreur lisible, ou null si elle a réussi. */
  onLogin: (email: string, password: string) => Promise<string | null>;
  onSignup: () => void;
  onForgot: () => void;
  /** Entrée « Démonstration hors ligne » (seulement quand la base n'est pas joignable). */
  onDemo?: () => void;
  /** « Continuer sans compte » : signaler et suivre sans se connecter. */
  onGuest?: () => void;
  /** Message déjà connu (session expirée, par exemple). */
  notice?: string | null;
};

export default function LoginScreen({ onLogin, onSignup, onForgot, onDemo, onGuest, notice }: Props) {
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <AppLogo />
          <Text style={styles.brand}>Priorix</Text>
          <Text style={styles.tagline}>
            Signalez les problèmes d’égouts{"\n"}et suivez vos demandes.
          </Text>
        </View>

        <View style={[styles.card, { paddingBottom: insets.bottom + 28 }]}>
          <Text style={styles.title}>Connexion</Text>

          <View style={[styles.field, error && !isValidEmail(email) && styles.fieldError]}>
            <Ionicons name="mail-outline" size={24} color={C.text} />
            <TextInput
              style={styles.input}
              placeholder="Courriel"
              placeholderTextColor={C.muted}
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

          <View style={[styles.field, error && isValidEmail(email) && !password && styles.fieldError]}>
            <Ionicons name="lock-closed-outline" size={24} color={C.text} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={C.muted}
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
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color={C.text} />
            </Pressable>
          </View>

          {notice && !error ? <Text style={styles.error}>{notice}</Text> : null}
          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <Pressable style={styles.forgot} onPress={onForgot} accessibilityRole="button">
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>

          <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={() => void handleLogin()} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }}>
            <Text style={styles.primaryText}>{busy ? "Connexion…" : "Se connecter"}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.secondary} onPress={onSignup} accessibilityRole="button">
            <Text style={styles.secondaryText}>Créer un compte</Text>
          </Pressable>
          {onGuest ? (
            <Pressable style={[styles.secondary, { marginTop: 12 }]} onPress={onGuest} accessibilityRole="button">
              <Text style={styles.secondaryText}>Continuer sans compte</Text>
            </Pressable>
          ) : null}
          {onDemo ? (
            <Pressable style={[styles.secondary, { marginTop: 12 }]} onPress={onDemo} accessibilityRole="button">
              <Text style={styles.secondaryText}>Démonstration hors ligne (simulée)</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.green,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brand: {
    color: C.cream,
    fontSize: 40,
    fontWeight: "800",
    marginTop: 18,
  },
  tagline: {
    color: "#ECE9DD",
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    flex: 1,
    backgroundColor: C.cream,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  title: {
    color: C.green,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 20,
  },
  field: {
    height: 58,
    borderWidth: 1.5,
    borderColor: Palette.borderForte,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 14,
    marginBottom: 14,
  },
  fieldError: {
    borderColor: C.error,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: C.text,
    height: "100%",
  },
  error: {
    color: C.error,
    fontSize: 14,
    marginTop: -4,
    marginBottom: 4,
  },
  forgot: {
    alignSelf: "flex-end",
    paddingVertical: 6,
  },
  forgotText: {
    color: C.green,
    fontSize: 15,
    fontWeight: "700",
  },
  primary: {
    height: 60,
    borderRadius: 30,
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryText: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: 18,
    paddingHorizontal: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.muted,
    fontSize: 16,
  },
  secondary: {
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: C.green,
    fontSize: 19,
    fontWeight: "800",
  },
});
