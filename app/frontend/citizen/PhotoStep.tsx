import React, { useRef, useState } from "react";
import { Image, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions as usePermissionCamera, type VueCamera } from "@/lib/camera-optionnelle";

const C = {
  green: "#1D341B",
  cream: "#F8F5ED",
  orange: "#E56C28",
  dark: "#23271F",
  skip: "#E4E6DA",
  white: "#FFFFFF",
};

/** Vérification de la photo par l'analyse : en cours, acceptée (égout), refusée (pas un égout) ou impossible. */
export type VerificationPhoto = { statut: "en_cours" | "acceptee" | "refusee" | "impossible"; message: string };

type Props = {
  photoUri?: string;
  onPhoto: (uri: string | undefined) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  /** Facultatif : sans vérification, l'écran se comporte comme avant. */
  verification?: VerificationPhoto | null;
};

const COULEUR_VERIFICATION: Record<VerificationPhoto["statut"], string> = {
  en_cours: C.dark,
  acceptee: C.green,
  refusee: "#B3261E",
  impossible: C.dark,
};

// Coins blancs qui encadrent la zone à photographier.
function FrameCorners() {
  return (
    <View pointerEvents="none" style={styles.frame}>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

export default function PhotoStep({ photoUri, onPhoto, onBack, onSkip, onContinue, verification }: Props) {
  // Tant que la photo est en vérification, on ne peut pas continuer ; une photo refusée est déjà retirée.
  const peutContinuer = !!photoUri && verification?.statut !== "en_cours";
  const insets = useSafeAreaInsets();
  const camera = useRef<VueCamera>(null);
  const [permission, requestPermission] = usePermissionCamera();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);

  async function capture() {
    if (photoUri) {
      onPhoto(undefined);
      return;
    }
    if (!CameraView) {
      // Pas de caméra intégrée : appareil photo du système.
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75 });
      if (!r.canceled) onPhoto(r.assets[0].uri);
      return;
    }
    if (!camera.current || !ready) return;
    const picture = await camera.current.takePictureAsync({ quality: 0.75 });
    if (picture?.uri) onPhoto(picture.uri);
  }

  async function chooseFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
    });
    if (!result.canceled) onPhoto(result.assets[0].uri);
  }

  function flipOrRetake() {
    if (photoUri) onPhoto(undefined);
    else setFacing((f) => (f === "back" ? "front" : "back"));
  }

  function renderPreview() {
    if (photoUri) {
      return <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
    }
    if (!CameraView) {
      return (
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={48} color={C.cream} />
          <Text style={styles.permissionText}>Touchez le bouton rond pour ouvrir l’appareil photo, ou choisissez une photo dans la galerie.</Text>
        </View>
      );
    }
    if (!permission) return null;
    if (!permission.granted) {
      return (
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={48} color={C.cream} />
          <Text style={styles.permissionText}>
            Autorisez l’accès à la caméra pour photographier le problème.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash ? "on" : "off"}
          onCameraReady={() => setReady(true)}
        />
        <FrameCorners />
        <Pressable
          style={styles.flashButton}
          onPress={() => setFlash((f) => !f)}
          accessibilityLabel={flash ? "Désactiver le flash" : "Activer le flash"}
        >
          <Ionicons name={flash ? "flash" : "flash-off"} size={22} color={C.white} />
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View style={styles.headerWave} />
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={30} color={C.cream} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Prendre une photo</Text>
            <Text style={styles.subtitle}>
              Ajoutez une photo du problème pour aider les équipes municipales.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cameraCard}>
        <View style={styles.preview}>{renderPreview()}</View>

        <View style={styles.controls}>
          <Pressable onPress={chooseFromLibrary} hitSlop={10} accessibilityLabel="Choisir dans la galerie">
            <Ionicons name="image-outline" size={34} color={C.cream} />
          </Pressable>

          <Pressable
            onPress={capture}
            style={styles.shutter}
            accessibilityLabel={photoUri ? "Reprendre la photo" : "Prendre la photo"}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            onPress={flipOrRetake}
            hitSlop={10}
            accessibilityLabel={photoUri ? "Reprendre la photo" : "Changer de caméra"}
          >
            <Ionicons name="sync-outline" size={34} color={C.cream} />
          </Pressable>
        </View>
      </View>

      {verification ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.verification, { borderColor: COULEUR_VERIFICATION[verification.statut] }]}
        >
          <Ionicons
            name={
              verification.statut === "acceptee"
                ? "checkmark-circle"
                : verification.statut === "refusee"
                  ? "close-circle"
                  : verification.statut === "en_cours"
                    ? "hourglass-outline"
                    : "information-circle-outline"
            }
            size={22}
            color={COULEUR_VERIFICATION[verification.statut]}
          />
          <Text style={[styles.verificationText, { color: COULEUR_VERIFICATION[verification.statut] }]}>
            {verification.message}
          </Text>
        </View>
      ) : null}

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Passer</Text>
        </Pressable>
        <Pressable
          style={[styles.continueButton, !peutContinuer && { opacity: 0.55 }]}
          onPress={onContinue}
          disabled={!peutContinuer}
        >
          <Text style={styles.continueText}>Continuer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CORNER = 34;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    backgroundColor: C.green,
    paddingHorizontal: 22,
    paddingBottom: 64,
    overflow: "hidden",
  },
  headerWave: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    right: -220,
    top: 30,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  title: {
    color: C.cream,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#E6E4D8",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 6,
  },
  cameraCard: {
    flex: 1,
    marginTop: -40,
    marginHorizontal: 0,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: C.dark,
  },
  preview: {
    flex: 1,
    backgroundColor: "#111",
  },
  frame: {
    position: "absolute",
    top: "18%",
    bottom: "18%",
    left: "16%",
    right: "16%",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: C.white,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  flashButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(20,24,18,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  permissionText: {
    color: C.cream,
    fontSize: 15,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: C.orange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: C.white,
    fontWeight: "800",
    fontSize: 15,
  },
  controls: {
    height: 104,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: C.dark,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.cream,
  },
  verification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: C.white,
  },
  verificationText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skipButton: {
    flex: 1,
    height: 60,
    backgroundColor: C.skip,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    color: C.green,
    fontWeight: "800",
    fontSize: 18,
  },
  continueButton: {
    flex: 1.4,
    height: 60,
    backgroundColor: C.orange,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
  },
});
