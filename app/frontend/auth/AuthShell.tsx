import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInputProps } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text, ChampTexte as TextInput } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMarque } from "@/components/logo-marque";
import { useMarque, useStyles } from "@/marque/utiliser";
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { BoutonAction } from '@/components/bouton-action';

// Coquille commune des écrans de compte (même allure que la connexion) : bandeau vert avec le logo, carte crème dessous.
export function AuthShell({ title, onBack, children }: { title: string; onBack?: () => void; children: React.ReactNode }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { organisation } = useMarque();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour à la connexion" style={styles.back}>
              <Ionicons name="arrow-back" size={28} color={P.onHeader} />
            </Pressable>
          ) : null}
          <LogoMarque taille={96} />
          <Text style={styles.brand}>{organisation.nom_app}</Text>
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
  const styles = useStyles(creerStyles);
  const P = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[styles.field, !!error && styles.fieldError]}>
        <Ionicons name={icon} size={24} color={P.text} />
        <TextInput
          style={styles.input}
          placeholder={label}
          placeholderTextColor={P.textSecondary}
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
  const styles = useStyles(creerStyles);
  return (
    outline ? (
      <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!busy }} style={[styles.secondary, busy && { opacity: 0.6 }, { marginTop: 8 }]}>
        <Text style={styles.secondaryText}>{busy ? "Un instant…" : label}</Text>
      </Pressable>
    ) : (
      <BoutonAction titre={label} occupe={!!busy} onPress={onPress} style={{ marginTop: 8 }} />
    )
  );
}

export function AuthMessage({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  return (
    <Text style={[styles.message, ok ? { color: P.success } : { color: P.danger }]} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: { flex: 1, backgroundColor: P.header },
  hero: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 28 },
  back: { position: "absolute", left: 20, top: 60 },
  brand: { color: P.onHeader, fontSize: 34, fontWeight: "800", marginTop: 14 },
  card: { flex: 1, backgroundColor: P.background, borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 28 },
  title: { color: P.primary, fontSize: 28, fontWeight: "800", marginBottom: 18 },
  field: { height: 58, borderWidth: 1.5, borderColor: P.borderForte, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12, backgroundColor: P.surface },
  fieldError: { borderColor: P.danger },
  input: { flex: 1, fontSize: 18, color: P.text },
  error: { color: P.danger, fontSize: 14, marginTop: 4, marginLeft: 6 },
  message: { fontSize: 15, marginBottom: 10 },
  primary: { height: 60, borderRadius: 30, backgroundColor: P.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: P.surface, fontSize: 19, fontWeight: "800" },
  secondary: { height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: P.primary, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: P.primary, fontSize: 19, fontWeight: "800" },
});
