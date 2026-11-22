
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Palette de couleurs
export const C = {
  bg: "#F5F3ED",
  white: "#FFFFFF",
  ink: "#263425",
  muted: "#647064",
  blue: "#31412F",
  green: "#4F7A57",
  red: "#D65A31",
  orange: "#F28A33",
  sage: "#C6D2C0",
  border: "#D8E0D2",
};

// Conteneur principal
export function Page({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      {children}
    </ScrollView>
  );
}

// Titre principal
export function Heading({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Text style={s.heading}>{children}</Text>;
}

// Sous-texte
export function Sub({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Text style={s.sub}>{children}</Text>;
}

// Carte de contenu
export function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={s.card}>{children}</View>;
}

// Bouton réutilisable
export function Btn({
  label,
  onPress,
  outline = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        outline && s.btnOutline,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          s.btnText,
          outline && { color: C.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Badge de statut
export function Status({
  label,
}: {
  label: string;
}) {
  return (
    <View style={s.status}>
      <Text style={s.statusText}>{label}</Text>
    </View>
  );
}

// Styles
const s = StyleSheet.create({
  page: {
    padding: 16,
    paddingBottom: 50,
    gap: 12,
    backgroundColor: C.bg,
    flexGrow: 1,
  },

  heading: {
    fontSize: 23,
    fontWeight: "800",
    color: C.ink,
  },

  sub: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
  },

  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 15,
    gap: 10,
  },

  btn: {
    backgroundColor: C.orange,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  btnOutline: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.orange,
  },

  btnText: {
    color: C.white,
    fontWeight: "700",
    fontSize: 14,
  },

  status: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#E6EFE3",
  },

  statusText: {
    color: C.ink,
    fontSize: 12,
    fontWeight: "700",
  },
});

// Export placé APRÈS la déclaration de s
export const styles = s;
