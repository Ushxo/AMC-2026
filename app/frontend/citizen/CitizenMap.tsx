
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SewerMap } from "../components/SewerMap";
import { SEWERS } from "../data/mockData";
import { useDemo } from "../context/DemoContext";
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

const categories: {
  id: AlertKind;
  icon: string;
  label: string;
}[] = [
  {
    id: "Égout bouché",
    icon: "🍂",
    label: "Égout bouché",
  },
  {
    id: "Eau accumulée",
    icon: "💧",
    label: "Accumulation d’eau / Inondation",
  },
  {
    id: "Feuilles",
    icon: "🕳️",
    label: "Affaissement autour d’un égout",
  },
  {
    id: "Autre",
    icon: "⚠️",
    label: "Grille d’égout endommagée",
  },
];

type Props = {
  onOpenAlerts?: () => void;
  onOpenProfile?: () => void;
};

export default function CitizenMap({
  onOpenAlerts,
  onOpenProfile,
}: Props) {
  const [selectedId, setSelectedId] =
    useState<string | undefined>();

  const [selectedKind, setSelectedKind] =
    useState<AlertKind>("Égout bouché");

  const [search, setSearch] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);

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

  function handleSubmit() {
    if (!selectedId) return;

    report(selectedId, selectedKind);

    setShowCamera(false);
    setShowReport(false);
    setSelectedId(undefined);
    setPhotoTaken(false);
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
    setPhotoTaken(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* EN-TÊTE */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            Carte des égouts
          </Text>

          <Pressable
            style={styles.profileButton}
            onPress={onOpenProfile}
          >
            <Text style={styles.profileIcon}>♙</Text>
          </Pressable>
        </View>

        {/* RECHERCHE */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une adresse à Montréal"
            placeholderTextColor={C.olive}
            value={search}
            onChangeText={setSearch}
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* CARTE */}
      <View style={styles.mapContainer}>
        <SewerMap
          selected={selectedId}
          onSelect={handleSelect}
        />

        {/* LOCALISATION SIMULÉE */}
        <Pressable style={styles.locationButton}>
          <Text style={styles.locationIcon}>◎</Text>
        </Pressable>

        {/* MESSAGE DE CONFIRMATION */}
        {confirmation && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>
                Signalement envoyé !
              </Text>
              <Text style={styles.successText}>
                Consultez Mes alertes pour suivre
                votre demande.
              </Text>
            </View>

            <Pressable
              onPress={() => setConfirmation(false)}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* NAVIGATION */}
      <View style={styles.bottomNav}>
        <View style={styles.activeTab}>
          <Text style={styles.navIcon}>●</Text>
          <Text style={styles.activeNavText}>Carte</Text>
        </View>

        <Pressable
          style={styles.inactiveTab}
          onPress={onOpenAlerts}
        >
          <Text style={styles.listIcon}>☷</Text>
          <Text style={styles.navText}>Mes alertes</Text>
        </Pressable>
      </View>

      {/* PANNEAU DE SIGNALEMENT */}
      {showReport && selectedSewer && (
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={handleClose}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              Quel problème avez-vous observé ?
            </Text>

            <Text style={styles.sewerLabel}>
              📍 {selectedSewer.label}
            </Text>

            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const active =
                  selectedKind === category.id;

                return (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      setSelectedKind(category.id)
                    }
                    style={[
                      styles.categoryCard,
                      active && styles.categoryActive,
                    ]}
                  >
                    <Text style={styles.categoryIcon}>
                      {category.icon}
                    </Text>

                    <Text style={styles.categoryText}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <Text style={styles.continueText}>
                Continuer
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* CAMÉRA SIMULÉE TEMPORAIRE */}
      {showCamera && (
        <View style={styles.overlay}>
          <View style={styles.cameraSheet}>
            <Pressable onPress={handleClose}>
              <Text style={styles.cameraBack}>←</Text>
            </Pressable>

            <Text style={styles.cameraTitle}>
              Prendre une photo
            </Text>

            <Text style={styles.cameraSubtitle}>
              Ajoutez une photo du problème pour
              aider les équipes municipales.
            </Text>

            <View style={styles.cameraPreview}>
              <Text style={styles.cameraEmoji}>📷</Text>

              <Text style={styles.cameraHint}>
                {photoTaken
                  ? "Photo capturée ✓"
                  : "Simulation de caméra"}
              </Text>

              <Pressable
                style={styles.captureButton}
                onPress={() => setPhotoTaken(true)}
              >
                <View style={styles.captureInner} />
              </Pressable>
            </View>

            <View style={styles.cameraActions}>
              <Pressable
                style={styles.skipButton}
                onPress={handleSubmit}
              >
                <Text style={styles.skipText}>
                  Passer
                </Text>
              </Pressable>

              <Pressable
                style={styles.cameraContinue}
                onPress={handleSubmit}
              >
                <Text style={styles.continueText}>
                  Continuer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },

  header: {
    backgroundColor: C.green,
    paddingHorizontal: 22,
    paddingTop: 35,
    paddingBottom: 23,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    zIndex: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 21,
  },

  headerTitle: {
    fontSize: 29,
    fontWeight: "900",
    color: C.white,
  },

  profileButton: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: C.white,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  profileIcon: {
    color: C.white,
    fontSize: 32,
  },

  searchContainer: {
    height: 56,
    backgroundColor: C.cream,
    borderRadius: 35,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  searchIcon: {
    fontSize: 35,
    color: C.green,
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.green,
  },

  clearSearch: {
    fontSize: 25,
    color: C.gray,
  },

  mapContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#E7EBDD",
    overflow: "hidden",
  },

  locationButton: {
    position: "absolute",
    right: 21,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 35,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  locationIcon: {
    fontSize: 37,
    color: C.green,
  },

  bottomNav: {
    backgroundColor: C.cream,
    flexDirection: "row",
    padding: 11,
    paddingBottom: 18,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
  },

  activeTab: {
    flex: 1,
    backgroundColor: C.sage,
    borderRadius: 30,
    alignItems: "center",
    paddingVertical: 11,
  },

  inactiveTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
  },

  navIcon: {
    fontSize: 28,
    color: C.green,
  },

  listIcon: {
    fontSize: 31,
    color: C.green,
  },

  activeNavText: {
    color: C.green,
    fontSize: 17,
    fontWeight: "800",
  },

  navText: {
    color: C.green,
    fontSize: 17,
    fontWeight: "700",
  },

  successCard: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: C.white,
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 5,
  },

  successIcon: {
    color: "#38834A",
    fontSize: 30,
    fontWeight: "900",
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

  closeText: {
    fontSize: 25,
    color: C.green,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },

  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 35,
  },

  sheetHandle: {
    width: 55,
    height: 5,
    backgroundColor: "#C5C4BC",
    alignSelf: "center",
    borderRadius: 10,
    marginBottom: 25,
  }

  sheetTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: C.green,
    marginBottom: 12,
    textAlign: "center",
  },

  sewerLabel: {
    textAlign: "center",
    color: C.gray,
    fontSize: 13,
    marginBottom: 20,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 13,
  },

  categoryCard: {
    width: "48%",
    height: 155,
    backgroundColor: "#E9EDDF",
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },

  categoryActive: {
    backgroundColor: "#FFF0DA",
    borderColor: C.orange,
  },

  categoryIcon: {
    fontSize: 53,
    marginBottom: 9,
  },

  categoryText: {
    color: C.green,
    fontSize: 15,
    textAlign: "center",
    fontWeight: "800",
  },

  continueButton: {
    height: 62,
    backgroundColor: C.orange,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },

  continueText: {
    color: C.white,
    fontSize: 21,
    fontWeight: "800",
  },

  cameraSheet: {
    backgroundColor: C.cream,
    height: "95%",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 22,
  },

  cameraBack: {
    color: C.green,
    fontSize: 36,
  },

  cameraTitle: {
    fontSize: 29,
    fontWeight: "900",
    color: C.green,
    marginTop: 8,
  },

  cameraSubtitle: {
    fontSize: 15,
    color: C.gray,
    marginTop: 7,
    marginBottom: 20,
  },

  cameraPreview: {
    flex: 1,
    backgroundColor: "#252923",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  cameraEmoji: {
    fontSize: 70,
  },

  cameraHint: {
    color: C.white,
    fontSize: 16,
    marginTop: 15,
  },

  captureButton: {
    position: "absolute",
    bottom: 22,
    width: 72,
    height: 72,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },

  captureInner: {
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: C.white,
  },

  cameraActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  skipButton: {
    flex: 1,
    height: 61,
    backgroundColor: "#E7E9DF",
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  skipText: {
    color: C.green,
    fontWeight: "800",
    fontSize: 19,
  },

  cameraContinue: {
    flex: 1.4,
    height: 61,
    backgroundColor: C.orange,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
});
