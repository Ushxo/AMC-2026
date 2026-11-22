
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { ProblemIllustration } from "../components/ProblemIllustration";
import { SEWERS } from "../data/mockData";
import { useDemo } from "../context/DemoContext";
import PhotoStep from "./PhotoStep";
import { AlertKind } from "../types/models";

const C = {
  green: "#1D341B",
  darkGreen: "#142B17",
  olive: "#31412F",
  cream: "#F8F5ED",
  lightCream: "#F2F0E7",
  sage: "#DCE5CC",
  orange: "#E56C28",
  white: "#FFFFFF",
  gray: "#666F60",
};

const categories: { id: AlertKind; label: string }[] = [
  { id: "Égout bouché", label: "Égout bouché" },
  { id: "Eau accumulée", label: "Accumulation d’eau /\nInondation" },
  { id: "Feuilles", label: "Affaissement\nautour d’un égout" },
  { id: "Autre", label: "Grille d’égout\nendommagée" },
];

type Props = {
  onOpenProfile?: () => void;
};

export default function CitizenMap({ onOpenProfile }: Props) {
  const insets = useSafeAreaInsets();
  const bottomOffset = BOTTOM_NAV_HEIGHT + insets.bottom;

  const [selectedId, setSelectedId] =
    useState<string | undefined>();

  const [selectedKind, setSelectedKind] =
    useState<AlertKind>("Égout bouché");

  const [search, setSearch] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [photoUri, setPhotoUri] =
    useState<string | undefined>();

  const { report } = useDemo();

  const selectedSewer = SEWERS.find(
    (sewer) => sewer.id === selectedId
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setSelectedKind("Égout bouché");
    setConfirmation(false);
    setShowReport(true);
    setShowCamera(false);
  }

  function handleContinue() {
    if (!selectedId) return;

    setShowReport(false);
    setShowCamera(true);
  }

  function handleSubmit(photo?: string) {
    if (!selectedId) return;

    report(selectedId, selectedKind, photo);

    setShowCamera(false);
    setShowReport(false);
    setSelectedId(undefined);
    setPhotoUri(undefined);
    setConfirmation(true);

    if (Platform.OS !== "web") {
      Alert.alert(
        "Alerte envoyée",
        "Ton signalement a bien été enregistré."
      );
    }
  }

  function handleClose() {
    setShowReport(false);
    setShowCamera(false);
    setSelectedId(undefined);
    setPhotoUri(undefined);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Emplacement de la carte : fond noir en attendant la carte réelle.
          La carte devra appeler handleSelect(id) quand on touche un égout. */}
      <View style={styles.map} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Carte des égouts</Text>

          <Pressable
            onPress={onOpenProfile}
            accessibilityLabel="Profil"
            hitSlop={8}
          >
            <Ionicons name="person-circle-outline" size={52} color={C.cream} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={26} color={C.green} />

          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une adresse à Montréal"
            placeholderTextColor={C.olive}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={C.gray} />
            </Pressable>
          )}
        </View>
      </View>

      <Pressable
        style={[styles.locationButton, { bottom: bottomOffset + 24 }]}
        accessibilityLabel="Me localiser"
      >
        <Ionicons name="locate" size={32} color={C.green} />
      </Pressable>

      {confirmation && (
        <View style={[styles.successCard, { top: insets.top + 150 }]}>
          <Ionicons name="checkmark-circle" size={30} color="#38834A" />

          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Signalement envoyé !</Text>
            <Text style={styles.successText}>
              Consultez Mes alertes pour suivre votre demande.
            </Text>
          </View>

          <Pressable onPress={() => setConfirmation(false)} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.green} />
          </Pressable>
        </View>
      )}

      <Modal
        visible={showReport && !!selectedSewer}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={handleClose}
            accessibilityLabel="Fermer"
          />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              Quel problème avez-vous observé ?
            </Text>

            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const active = selectedKind === category.id;

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedKind(category.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.categoryCard, active && styles.categoryActive]}
                  >
                    <ProblemIllustration kind={category.id} />
                    <Text style={styles.categoryText}>{category.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>Continuer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <PhotoStep
          photoUri={photoUri}
          onPhoto={setPhotoUri}
          onBack={() => {
            // Retour au choix du problème.
            setShowCamera(false);
            setPhotoUri(undefined);
            setShowReport(true);
          }}
          onSkip={() => handleSubmit(undefined)}
          onContinue={() => handleSubmit(photoUri)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  map: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },

  header: {
    backgroundColor: C.green,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: C.white,
  },

  searchContainer: {
    height: 54,
    backgroundColor: C.cream,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: C.green,
  },

  locationButton: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },

  successCard: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: C.white,
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },

  successTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.green,
  },

  successText: {
    color: C.gray,
    fontSize: 12,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 20,
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.30)",
  },

  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 12,
  },

  sheetHandle: {
    width: 48,
    height: 5,
    backgroundColor: "#C9C7BD",
    alignSelf: "center",
    borderRadius: 10,
    marginBottom: 22,
  },

  sheetTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: C.green,
    marginBottom: 22,
    textAlign: "center",
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  categoryCard: {
    width: "48%",
    height: 168,
    backgroundColor: "#ECEBE1",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },

  categoryActive: {
    backgroundColor: "#FCE3CC",
    borderColor: C.orange,
  },

  categoryText: {
    color: C.green,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "700",
    marginTop: 8,
  },

  continueButton: {
    height: 60,
    backgroundColor: C.orange,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  continueText: {
    color: C.white,
    fontSize: 21,
    fontWeight: "800",
  },
});
