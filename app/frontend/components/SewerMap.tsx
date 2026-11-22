
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SEWERS } from "../data/mockData";
import { useDemo } from "../context/DemoContext";

const colors = {
  green: "#263425",
  olive: "#31412F",
  sage: "#C6D2C0",
  orange: "#F28A33",
  red: "#D65A31",
  white: "#FFFFFF",
};

type SewerMapProps = {
  selected?: string;
  onSelect?: (id: string) => void;
  route?: string[];
};

export function SewerMap({
  selected,
  onSelect,
  route = [],
}: SewerMapProps) {
  const { rank } = useDemo();

  return (
    <View style={styles.map}>
      {/* Fond cartographique schématique */}
      <View style={styles.mapBackground} />

      {/* Rues verticales */}
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={`vertical-${i}`}
          style={[
            styles.verticalStreet,
            { left: `${i * 20}%` as any },
          ]}
        />
      ))}

      {/* Rues horizontales */}
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={`horizontal-${i}`}
          style={[
            styles.horizontalStreet,
            { top: `${i * 25}%` as any },
          ]}
        />
      ))}

      {/* Zone de quartier */}
      <View style={styles.district}>
        <Text style={styles.districtText}>
          MONTRÉAL
        </Text>
      </View>

      {/* Marqueurs des égouts */}
      {SEWERS.map((sewer) => {
        const isSelected = selected === sewer.id;
        const hasReports = Boolean(rank(sewer.id));
        const routeIndex = route.indexOf(sewer.id);
        const isOnRoute = routeIndex !== -1;

        const markerColor = isSelected
          ? colors.green
          : hasReports
          ? colors.red
          : colors.orange;

        return (
          <Pressable
            key={sewer.id}
            accessibilityRole="button"
            accessibilityLabel={sewer.label}
            onPress={() => onSelect?.(sewer.id)}
            style={[
              styles.marker,
              {
                left: `${sewer.x}%` as any,
                top: `${sewer.y}%` as any,
                backgroundColor: markerColor,
              },
              isSelected && styles.selectedMarker,
            ]}
          >
            <Text style={styles.markerText}>
              {isOnRoute
                ? String(routeIndex + 1)
                : "●"}
            </Text>
          </Pressable>
        );
      })}

      {/* Légende sur la carte */}
      <View style={styles.mapLabel}>
        <View style={styles.labelDot} />
        <Text style={styles.mapLabelText}>
          Carte de démonstration
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 360,
    backgroundColor: "#DCE5D6",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  mapBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#C6D2C0",
  },
  verticalStreet: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 11,
    backgroundColor: "#F5F3ED",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E7E9DF",
  },
  horizontalStreet: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 11,
    backgroundColor: "#F5F3ED",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E7E9DF",
  },
  district: {
    position: "absolute",
    top: 20,
    left: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "rgba(38,52,37,0.85)",
    borderRadius: 10,
  },
  districtText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  marker: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -17,
    marginTop: -17,
    elevation: 3,
  },
  selectedMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 4,
    marginLeft: -21,
    marginTop: -21,
  },
  markerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  mapLabel: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.93)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  labelDot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  mapLabelText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: "700",
  },
});

