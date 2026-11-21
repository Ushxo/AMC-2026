
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Page } from "../components/UI";
import { SewerMap } from "../components/SewerMap";
import { SEWERS } from "../data/mockData";
import { useDemo } from "../context/DemoContext";
import { AlertKind } from "../types/models";

const colors = {
  green: "#263425",
  olive: "#31412F",
  sage: "#C6D2C0",
  orange: "#F28A33",
  cream: "#F5F3ED",
  white: "#FFFFFF",
  muted: "#647064",
};

const categories: {
  id: AlertKind;
  icon: string;
  description: string;
}[] = [
  {
    id: "Feuilles",
    icon: "🍂",
    description: "Feuilles",
  },
  {
    id: "Eau accumulée",
    icon: "💧",
    description: "Eau accumulée",
  },
  {
    id: "Égout bouché",
    icon: "🚧",
    description: "Égout bouché",
  },
  {
    id: "Autre",
    icon: "⚠️",
    description: "Autre",
  },
];

export default function CitizenMap() {
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedKind, setSelectedKind] =
    useState<AlertKind>("Feuilles");
  const [confirmation, setConfirmation] = useState(false);

  const { report } = useDemo();

  const selectedSewer = SEWERS.find(
    (sewer) => sewer.id === selectedId
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setSelectedKind("Feuilles");
    setConfirmation(false);
  }

  function handleReport() {
    if (!selectedId) return;

    report(selectedId, selectedKind);
    setSelectedId(undefined);
    setConfirmation(true);

    if (Platform.OS !== "web") {
      Alert.alert(
        "Alerte envoyée",
        "Ton signalement a bien été enregistré."
      );
    }
  }

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          ESPACE CITOYEN
        </Text>

        <Text style={styles.title}>
          Carte des égouts
        </Text>

        <Text style={styles.subtitle}>
          Repère un égout sur la carte et signale un
          problème en quelques secondes.
        </Text>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <Text style={styles.mapTitle}>
              Montréal
            </Text>

            <Text style={styles.mapDescription}>
              Réseau d'égouts
            </Text>
          </View>

          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>
              CARTE
            </Text>
          </View>
        </View>

        <SewerMap
          selected={selectedId}
          onSelect={handleSelect}
        />

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.orangeDot} />
            <Text style={styles.legendText}>
              Égout
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={styles.redDot} />
            <Text style={styles.legendText}>
              Signalements
            </Text>
          </View>
        </View>
      </View>

      {confirmation && (
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>
              Alerte envoyée !
            </Text>
            <Text style={styles.successText}>
              Tu peux suivre son avancement dans
              « Mes alertes ».
            </Text>
          </View>
        </View>
      )}

      {selectedSewer && (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>
                NOUVEAU SIGNALEMENT
              </Text>

              <Text style={styles.reportTitle}>
                {selectedSewer.label}
              </Text>

              <Text style={styles.reportSubtitle}>
                Quel problème as-tu remarqué ?
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedId(undefined)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

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
                    styles.categoryButton,
                    active && styles.categorySelected,
                  ]}
                >
                  <Text style={styles.categoryIcon}>
                    {category.icon}
                  </Text>

                  <Text
                    style={[
                      styles.categoryText,
                      active && styles.categoryTextActive,
                    ]}
                  >
                    {category.description}
                  </Text>

                  {active && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoTitle}>
                Ajouter une photo
              </Text>
              <Text style={styles.photoSubtitle}>
                Disponible prochainement
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.submitButton}
            onPress={handleReport}
          >
            <Text style={styles.submitText}>
              Envoyer l'alerte
            </Text>
            <Text style={styles.submitArrow}>→</Text>
          </Pressable>
        </View>
      )}

      {!selectedSewer && !confirmation && (
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText}>
            Sélectionne un marqueur sur la carte pour
            signaler un problème.
          </Text>
        </View>
      )}

      <Text style={styles.demoNote}>
        Données géographiques fictives pour la démonstration.
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.green,
    borderRadius: 22,
    padding: 23,
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.sage,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: colors.white,
    fontSize: 29,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.sage,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  mapCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E4E9DF",
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.green,
  },
  mapDescription: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  mapBadge: {
    backgroundColor: "#E7EEE4",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  mapBadgeText: {
    color: colors.olive,
    fontSize: 10,
    fontWeight: "800",
  },
  legend: {
    flexDirection: "row",
    gap: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    color: colors.olive,
    fontSize: 12,
  },
  orangeDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.orange,
  },
  redDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#D65A31",
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#E6F0E6",
    borderRadius: 17,
    padding: 18,
    marginBottom: 16,
  },
  successIcon: {
    color: "#377B4B",
    fontSize: 27,
    fontWeight: "800",
  },
  successTitle: {
    fontSize: 16,
    color: colors.green,
    fontWeight: "800",
  },
  successText: {
    color: colors.olive,
    fontSize: 13,
    marginTop: 3,
  },
  reportCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E4E9DF",
    marginBottom: 16,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  sectionEyebrow: {
    color: colors.orange,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  reportTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.green,
  },
  reportSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 5,
  },
  closeButton: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F1EE",
    borderRadius: 17,
  },
  closeText: {
    fontSize: 25,
    color: colors.olive,
    lineHeight: 28,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryButton: {
    width: "48%",
    minHeight: 100,
    backgroundColor: "#F8F9F6",
    borderWidth: 1,
    borderColor: "#E1E6DC",
    borderRadius: 16,
    padding: 13,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  categorySelected: {
    borderColor: colors.orange,
    borderWidth: 2,
    backgroundColor: "#FFF3E7",
  },
  categoryIcon: {
    fontSize: 25,
    marginBottom: 8,
  },
  categoryText: {
    color: colors.olive,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  categoryTextActive: {
    color: colors.green,
  },
  check: {
    position: "absolute",
    top: 7,
    right: 10,
    color: colors.orange,
    fontWeight: "900",
  },
  photoPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E8E1",
    marginTop: 20,
    marginBottom: 18,
  },
  photoIcon: {
    fontSize: 24,
  },
  photoTitle: {
    color: colors.green,
    fontWeight: "700",
    fontSize: 13,
  },
  photoSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  submitButton: {
    backgroundColor: colors.orange,
    minHeight: 54,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  submitText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 16,
  },
  submitArrow: {
    color: colors.white,
    fontSize: 23,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 17,
    borderRadius: 15,
    backgroundColor: "#E8EEE4",
  },
  infoIcon: {
    fontSize: 22,
  },
  infoText: {
    flex: 1,
    color: colors.olive,
    fontSize: 13,
    lineHeight: 19,
  },
  demoNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#788475",
    marginBottom: 10,
  },
});

