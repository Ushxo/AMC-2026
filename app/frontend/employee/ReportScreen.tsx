import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Texte as Text } from "@/components/texte";
import { formaterDate } from "@/lib/format";
import type { Evaluation } from "@/lib/rapport";
import { idArret } from "@/lib/trajet";
import type { Arret } from "@/types";
import { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { E, Header, type InfoArret } from "./shared";

type Props = {
  arrets: Arret[];
  infos: Map<string, InfoArret>;
  evaluation: (a: Arret) => Evaluation | null;
  envoyeLe: string | null;
  envoi: boolean;
  erreur: string | null;
  onEnvoyer: () => void;
};

// Rapport : l'état de chaque arrêt de la tournée et l'envoi au superviseur.
export default function ReportScreen({ arrets, infos, evaluation, envoyeLe, envoi, erreur, onEnvoyer }: Props) {
  const insets = useSafeAreaInsets();
  const evalues = arrets.filter((a) => evaluation(a)).length;
  const complet = arrets.length > 0 && evalues === arrets.length;

  const etat = envoyeLe
    ? { label: `Envoyé au superviseur le ${formaterDate(envoyeLe)}`, color: E.green, bg: E.sageSoft }
    : complet
      ? { label: "Prêt à envoyer", color: "#8A6A05", bg: "#FBF0CE" }
      : { label: "En cours", color: E.orange, bg: "#FCE5D2" };

  return (
    <View style={styles.root}>
      <Header title="Rapport" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 20 }]}>
        {arrets.length === 0 ? (
          <Text style={styles.empty}>Aucune tournée pour votre équipe pour le moment.</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tournée actuelle</Text>
            <Text style={[styles.state, { color: etat.color, backgroundColor: etat.bg }]}>{etat.label}</Text>
            <Text style={styles.progress}>
              {evalues}/{arrets.length} arrêts évalués
            </Text>

            {arrets.map((a) => {
              const ev = evaluation(a);
              const info = infos.get(idArret(a));
              const icone = !ev ? "ellipse-outline" : ev.regle ? "checkmark-circle" : "alert-circle";
              const couleur = !ev ? E.muted : ev.regle ? E.green : E.orange;
              return (
                <View key={idArret(a)} style={styles.item}>
                  <Ionicons name={icone} size={24} color={couleur} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {a.rang}. {info?.titre ?? "Arrêt"}
                    </Text>
                    <Text style={styles.itemSub}>
                      {info?.lieu ?? ""} · {!ev ? "À évaluer" : ev.regle ? "Réparé" : "Pas réglé"}
                    </Text>
                    {ev?.commentaire ? <Text style={styles.reason}>« {ev.commentaire} »</Text> : null}
                  </View>
                </View>
              );
            })}

            {erreur ? <Text style={styles.erreur} accessibilityRole="alert">{erreur}</Text> : null}
            {complet && !envoyeLe ? (
              <Pressable style={[styles.send, envoi && { opacity: 0.6 }]} disabled={envoi} onPress={onEnvoyer} accessibilityRole="button">
                <Text style={styles.sendText}>{envoi ? "Envoi…" : "Envoyer le rapport au superviseur"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  empty: {
    color: E.muted,
    fontSize: 16,
    textAlign: "center",
    marginTop: 30,
  },
  card: {
    backgroundColor: E.card,
    borderRadius: 22,
    padding: 16,
    shadowColor: "#1A261A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#151A13",
  },
  state: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  progress: {
    color: E.muted,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 6,
  },
  item: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#ECE9DE",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: E.text,
  },
  itemSub: {
    fontSize: 13,
    color: E.muted,
    marginTop: 2,
  },
  reason: {
    fontSize: 13,
    color: E.text,
    fontStyle: "italic",
    marginTop: 4,
  },
  erreur: {
    color: E.red,
    fontSize: 14,
    marginTop: 10,
  },
  send: {
    height: 56,
    borderRadius: 28,
    backgroundColor: E.orange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  sendText: {
    color: E.white,
    fontSize: 17,
    fontWeight: "800",
  },
});
