import React, { useMemo } from "react";
import { Image, Pressable, StatusBar, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Texte as Text } from "@/components/texte";
import { useEndroits } from "@/hooks/use-endroits";
import { formaterDate } from "@/lib/format";
import { lieuDeEndroit } from "@/lib/interventions";
import { chargerAdresses } from "@/lib/officiel";
import { idArret } from "@/lib/trajet";
import { LIBELLES_CATEGORIE, type Arret, type Categorie } from "@/types";
import { ILLUSTRATION_PAR_CATEGORIE, ProblemIllustration } from "../components/ProblemIllustration";

export const E = {
  green: "#1D3A1B",
  cream: "#F8F4EA",
  card: "#FCF8F0",
  orange: "#E0661C",
  sageSoft: "#E3EED8",
  sageBorder: "#3E6B36",
  border: "#D9D8CC",
  text: "#2B3328",
  muted: "#6E7468",
  white: "#FFFFFF",
  red: "#C8221B",
};

/** Ce qu'on montre d'un arrêt : le problème, la photo du citoyen, l'adresse et la date du signalement. */
export type InfoArret = {
  arret: Arret;
  categorie: Categorie;
  titre: string;
  photo: string | null;
  lieu: string;
  signaleLe: string | null;
};

/** Infos des arrêts d'une tournée, lues dans les signalements de chaque endroit. */
export function useInfosArrets(arrets: Arret[]): Map<string, InfoArret> {
  const { endroits } = useEndroits();
  const adresses = useMemo(() => chargerAdresses(), []);
  return useMemo(() => {
    const parCle = new Map(endroits.map((e) => [e.cle, e]));
    const infos = new Map<string, InfoArret>();
    for (const a of arrets) {
      const signalements = (parCle.get(a.cle_endroit)?.signalements ?? []).filter((s) => a.signalement_ids.includes(s.id));
      const recents = [...signalements].sort((x, y) => y.cree_le.localeCompare(x.cree_le));
      const categorie = recents[0]?.categorie ?? "grille_bouchee";
      infos.set(idArret(a), {
        arret: a,
        categorie,
        titre: LIBELLES_CATEGORIE[categorie],
        photo: recents.find((s) => s.photo_url)?.photo_url ?? null,
        lieu: lieuDeEndroit(a.position, adresses),
        signaleLe: recents[0]?.cree_le ?? null,
      });
    }
    return infos;
  }, [arrets, endroits, adresses]);
}

type Bouton = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

// En-tête vert : titre centré, bouton à gauche et à droite facultatifs.
export function Header({ title, left, right }: { title: string; left?: Bouton; right?: Bouton }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.side}>
        {left && (
          <Pressable onPress={left.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={left.label}>
            <Ionicons name={left.icon} size={28} color={E.cream} />
          </Pressable>
        )}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {right && (
          <Pressable onPress={right.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={right.label}>
            <Ionicons name={right.icon} size={26} color={E.cream} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Photo du citoyen si elle existe, sinon l'illustration du problème.
export function StopPhoto({ info, size = 96 }: { info: InfoArret; size?: number }) {
  if (info.photo) {
    return <Image source={{ uri: info.photo }} style={[styles.photo, { width: size, height: size }]} accessibilityLabel="Photo du signalement" />;
  }
  const kind = ILLUSTRATION_PAR_CATEGORIE[info.categorie] ?? "Égout bouché";
  return (
    <View style={[styles.photo, styles.photoFallback, { width: size, height: size }]}>
      <View style={{ transform: [{ scale: (size - 8) / 120 }] }}>
        <ProblemIllustration kind={kind} />
      </View>
    </View>
  );
}

export function StopSummary({ info, showDate = true }: { info: InfoArret; showDate?: boolean }) {
  return (
    <View style={styles.summary}>
      <StopPhoto info={info} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{info.titre}</Text>
        <View style={styles.row}>
          <Ionicons name="location" size={15} color={E.red} />
          <Text style={styles.detail}>{info.lieu}</Text>
        </View>
        {showDate && info.signaleLe ? <Text style={styles.date}>• Signalé le {formaterDate(info.signaleLe)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: E.green,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 2,
  },
  side: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: E.cream,
    fontSize: 20,
    fontWeight: "800",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  photo: {
    borderRadius: 14,
  },
  photoFallback: {
    backgroundColor: "#ECEBE1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#151A13",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detail: {
    flexShrink: 1,
    color: E.text,
    fontSize: 14,
  },
  date: {
    color: E.muted,
    fontSize: 13,
    marginTop: 5,
  },
});
