import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View, type TextInputProps } from 'react-native';
import { Texte as Text, ChampTexte as TextInput } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";
import { AppLogo } from "../components/AppLogo";

// Coquille commune des écrans de compte (même allure que la connexion) : bandeau vert avec le logo, carte crème dessous.
export function AuthShell({ title, onBack, children }: { title: string; onBack?: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour à la connexion" style={styles.back}>
              <Ionicons name="arrow-back" size={28} color={Palette.onHeader} />
            </Pressable>
          ) : null}
          <AppLogo />
          <Text style={styles.brand}>Priorix</Text>
        </View>
        <View style={[styles.card, { paddingBottom: insets.bottom + 28 }]}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type ChampProps = TextInputProps & { icon: keyof typeof Ionicons.glyphMap; label: string; error?: string | null };

// Champ de saisie avec icône ; l'erreur s'affiche juste dessous.
export function AuthField({ icon, label, error, ...rest }: ChampProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[styles.field, !!error && styles.fieldError]}>
        <Ionicons name={icon} size={24} color={Palette.text} />
        <TextInput
          style={styles.input}
          placeholder={label}
          placeholderTextColor={Palette.textSecondary}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function AuthButton({ label, onPress, busy, outline }: { label: string; onPress: () => void; busy?: boolean; outline?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      style={[outline ? styles.secondary : styles.primary, busy && { opacity: 0.6 }, { marginTop: 8 }]}
    >
      <Text style={outline ? styles.secondaryText : styles.primaryText}>{busy ? "Un instant…" : label}</Text>
    </Pressable>
  );
}

export function AuthMessage({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <Text style={[styles.message, ok ? { color: Palette.success } : { color: Palette.danger }]} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.header },
  hero: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 28 },
  back: { position: "absolute", left: 20, top: 60 },
  brand: { color: Palette.onHeader, fontSize: 34, fontWeight: "800", marginTop: 14 },
  card: { flex: 1, backgroundColor: Palette.onHeader, borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 28 },
  title: { color: Palette.header, fontSize: 28, fontWeight: "800", marginBottom: 18 },
  field: { height: 58, borderWidth: 1.5, borderColor: Palette.borderForte, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12, backgroundColor: Palette.surface },
  fieldError: { borderColor: Palette.danger },
  input: { flex: 1, fontSize: 18, color: Palette.text },
  error: { color: Palette.danger, fontSize: 14, marginTop: 4, marginLeft: 6 },
  message: { fontSize: 15, marginBottom: 10 },
  primary: { height: 60, borderRadius: 30, backgroundColor: Palette.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: Palette.surface, fontSize: 19, fontWeight: "800" },
  secondary: { height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: Palette.header, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: Palette.header, fontSize: 19, fontWeight: "800" },
});
