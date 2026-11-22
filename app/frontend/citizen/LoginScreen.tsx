
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

type LoginProps = {
  onLogin: () => void;
};

const COLORS = {
  green: "#1D341B",
  darkGreen: "#142B17",
  cream: "#F8F5ED",
  orange: "#E56C28",
  border: "#B9BAB2",
  gray: "#666666",
  white: "#FFFFFF",
};

export default function LoginScreen({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* EN-TÊTE */}
        <View style={styles.header}>
          {/* LOGO */}
          <View style={styles.logo}>
            <Text style={styles.logoMap}>╱╲╱╲</Text>
            <View style={styles.logoPin}>
              <View style={styles.logoDrain}>
                <Text style={styles.drainIcon}>▤</Text>
              </View>
            </View>
          </View>

          <Text style={styles.appName}>ÉgoutMontréal</Text>

          <Text style={styles.subtitle}>
            Signalez les problèmes d’égouts
            {"\n"}et suivez vos demandes.
          </Text>
        </View>

        {/* FORMULAIRE */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>
            {isRegister ? "Créer un compte" : "Connexion"}
          </Text>

          {/* COURRIEL */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>✉</Text>
            <TextInput
              style={styles.input}
              placeholder="Courriel"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* MOT DE PASSE */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>♙</Text>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIcon}>
                {showPassword ? "◉" : "◎"}
              </Text>
            </TouchableOpacity>
          </View>

          {!isRegister && (
            <TouchableOpacity style={styles.forgotButton}>
              <Text style={styles.forgotText}>
                Mot de passe oublié ?
              </Text>
            </TouchableOpacity>
          )}

          {/* BOUTON PRINCIPAL */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={onLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.loginText}>
              {isRegister ? "Créer mon compte" : "Se connecter"}
            </Text>
          </TouchableOpacity>

          {/* SÉPARATEUR */}
          <View style={styles.separator}>
            <View style={styles.line} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.line} />
          </View>

          {/* CRÉER COMPTE */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => setIsRegister(!isRegister)}
            activeOpacity={0.8}
          >
            <Text style={styles.registerText}>
              {isRegister
                ? "Retour à la connexion"
                : "Créer un compte"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.green,
  },

  scroll: {
    flexGrow: 1,
  },

  header: {
    minHeight: 340,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 65,
    paddingBottom: 35,
    paddingHorizontal: 20,
    backgroundColor: COLORS.green,
  },

  logo: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: "#30482A",
    borderWidth: 2,
    borderColor: "#A7B9A0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 15,
  },

  logoMap: {
    position: "absolute",
    color: "#A7B9A0",
    fontSize: 35,
    opacity: 0.5,
  },

  logoPin: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.orange,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },

  logoDrain: {
    width: 52,
    height: 52,
    backgroundColor: COLORS.darkGreen,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },

  drainIcon: {
    color: COLORS.white,
    fontSize: 39,
    fontWeight: "bold",
  },

  appName: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -1,
  },

  subtitle: {
    color: COLORS.white,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 27,
    marginTop: 8,
  },

  formContainer: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 45,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.darkGreen,
    marginBottom: 28,
  },

  inputContainer: {
    height: 59,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    marginBottom: 15,
  },

  inputIcon: {
    fontSize: 27,
    color: "#17251B",
    width: 42,
  },

  input: {
    flex: 1,
    fontSize: 18,
    color: COLORS.darkGreen,
  },

  eyeIcon: {
    fontSize: 28,
    color: "#17251B",
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 5,
    marginBottom: 25,
  },

  forgotText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.darkGreen,
  },

  loginButton: {
    backgroundColor: COLORS.orange,
    height: 62,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  loginText: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
  },

  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
    gap: 15,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#AAAAA2",
  },

  orText: {
    color: COLORS.gray,
    fontSize: 17,
    fontWeight: "600",
  },

  registerButton: {
    height: 62,
    borderRadius: 40,
    borderWidth: 1.8,
    borderColor: "#638265",
    justifyContent: "center",
    alignItems: "center",
  },

  registerText: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.darkGreen,
  },
});
