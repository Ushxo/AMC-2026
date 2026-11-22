import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeSewer } from "../supervisor/planning";
import { E, Header, StopSummary } from "./shared";

type Choice = "oui" | "non";

type Props = {
  info: ReturnType<typeof describeSewer>;
  onBack: () => void;
  onSend: (fixed: boolean, comment: string) => void;
};

// État du travail : le responsable indique si le problème est réglé.
export default function EvaluateScreen({ info, onBack, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [comment, setComment] = useState("");

  const canSend = choice === "oui" || (choice === "non" && comment.trim().length > 0);

  function Option({ value, label }: { value: Choice; label: string }) {
    const selected = choice === value;
    return (
      <Pressable
        onPress={() => setChoice(value)}
        style={[styles.option, selected && styles.optionSelected]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={28}
          color={selected ? E.green : E.text}
        />
        <Text style={styles.optionText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="État du travail" left={{ icon: "arrow-back", label: "Retour", onPress: onBack }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StopSummary info={info} showDate={false} />
        <View style={styles.divider} />

        <Text style={styles.question}>Le problème est-il réglé ?</Text>
        <Option value="oui" label="Oui, réparé" />
        <Option value="non" label="Non, pas réglé" />

        {choice === "non" && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>
              <Text style={{ fontWeight: "700" }}>Commentaire</Text> (obligatoire)
            </Text>
            <TextInput
              style={styles.comment}
              value={comment}
              onChangeText={setComment}
              placeholder="Ex. : grille endommagée, nécessite un remplacement."
              placeholderTextColor={E.muted}
              multiline
              autoFocus
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.send, !canSend && { opacity: 0.5 }]}
          disabled={!canSend}
          onPress={() => onSend(choice === "oui", comment.trim())}
        >
          <Text style={styles.sendText}>Envoyer le rapport</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  content: {
    padding: 18,
    paddingTop: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E0D4",
    marginVertical: 20,
  },
  question: {
    fontSize: 22,
    fontWeight: "800",
    color: E.green,
    textAlign: "center",
    marginBottom: 18,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 62,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: E.border,
    backgroundColor: "#F1EEE3",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  optionSelected: {
    backgroundColor: E.sageSoft,
    borderColor: E.sageBorder,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#151A13",
  },
  label: {
    color: E.text,
    fontSize: 15,
    marginBottom: 8,
  },
  comment: {
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: E.border,
    backgroundColor: E.white,
    padding: 14,
    fontSize: 16,
    color: E.text,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  send: {
    height: 60,
    borderRadius: 30,
    backgroundColor: E.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: E.white,
    fontSize: 20,
    fontWeight: "800",
  },
});
