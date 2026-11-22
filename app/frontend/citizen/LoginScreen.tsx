import React, { useState } from "react";
import {
  Alert,
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

import { isValidEmail, Session, sessionForEmail } from "../auth";
import { AppLogo } from "../components/AppLogo";

const C = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  orange: "#EE5F12",
  border: "#C9C9BD",
  text: "#2B3328",
  muted: "#6E7468",
  white: "#FFFFFF",
  error: "#C2410C",
};

type Props = {
  onLogin: (session: Session) => void;
};

function notAvailable(title: string) {
  const message = "Cette fonction n’est pas encore disponible dans la démo.";
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function LoginScreen({ onLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLogin() {
    if (!isValidEmail(email)) {
      setError("Entrez un courriel valide.");
      return;
    }
    if (!password) {
      setError("Entrez votre mot de passe.");
      return;
    }
    setError(null);
    onLogin(sessionForEmail(email));
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
          <Text style={styles.brand}>Piorix</Text>
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
              onSubmitEditing={handleLogin}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color={C.text} />
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.forgot} onPress={() => notAvailable("Mot de passe oublié")}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>

          <Pressable style={styles.primary} onPress={handleLogin}>
            <Text style={styles.primaryText}>Se connecter</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.secondary} onPress={() => notAvailable("Créer un compte")}>
            <Text style={styles.secondaryText}>Créer un compte</Text>
          </Pressable>
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
    borderColor: C.border,
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
