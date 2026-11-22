import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions as usePermissionCamera, type VueCamera } from "@/lib/camera-optionnelle";
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { MESSAGE_ASTUCE_PHOTO } from '@/lib/messages-seuil';
import { reveillerUneFois } from '@/lib/reveil-ml';
import { CAMERA } from '@/components/ville/style';

// Commandes de la caméra : couleurs fixes (fond sombre de l'objectif). Le reste de l'écran suit la marque.
const C = { cream: CAMERA.creme, dark: CAMERA.sombre, white: CAMERA.blanc };

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

function couleurVerification(statut: VerificationPhoto["statut"], P: Jetons): string {
  if (statut === "acceptee") return P.primary;
  if (statut === "refusee") return P.danger;
  return P.text;
}

// Coins blancs qui encadrent la zone à photographier.
function FrameCorners() {
  const styles = useStyles(creerStyles);
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
  const P = useTheme();
  const styles = useStyles(creerStyles);
  // Tant que la photo est en vérification, on ne peut pas continuer ; une photo refusée est déjà retirée.
  const peutContinuer = !!photoUri && verification?.statut !== "en_cours";
  const insets = useSafeAreaInsets();
  const camera = useRef<VueCamera>(null);
  const [permission, requestPermission] = usePermissionCamera();
  const [facing, setFacing] = useState<"back" | "front">("back");
  // Éclairage voulu par la personne : lampe en continu (caméra arrière seulement), éteinte dès qu'on quitte la caméra.
  const [eclairage, setEclairage] = useState(false);
  const [ready, setReady] = useState(false);

  // Le service d'analyse se réveille dès l'ouverture de l'étape (il peut dormir).
  useEffect(() => {
    reveillerUneFois();
  }, []);

  const arriere = facing === "back";
  const lampe = eclairage && arriere && !photoUri;

  // La lampe s'éteint : photo gardée, passage à la caméra avant, app en arrière-plan.
  useEffect(() => {
    if (photoUri || !arriere) setEclairage(false);
  }, [photoUri, arriere]);
  useEffect(() => {
    const abonne = AppState.addEventListener?.("change", (e: string) => {
      if (e !== "active") setEclairage(false);
    });
    return () => abonne?.remove?.();
  }, []);

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
          <Pressable accessibilityRole="button" accessibilityLabel="Autoriser la caméra" style={styles.permissionButton} onPress={requestPermission}>
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
          flash={lampe ? "on" : "off"}
          enableTorch={lampe}
          onCameraReady={() => setReady(true)}
        />
        <FrameCorners />
        <Pressable
          accessibilityRole="button"
          disabled={!arriere}
          style={[styles.flashButton, lampe && styles.flashAllume, !arriere && styles.flashInactif]}
          onPress={() => setEclairage((f) => !f)}
          accessibilityLabel={!arriere ? "Pas d'éclairage avec la caméra avant" : lampe ? "Éteindre l'éclairage" : "Allumer l'éclairage"}
          accessibilityState={{ disabled: !arriere, selected: lampe }}
        >
          <Ionicons name={lampe ? "flash" : "flash-off"} size={22} color={lampe ? C.dark : C.white} />
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.root}>

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View style={styles.headerWave} />
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={30} color={P.onHeader} />
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
          <Pressable accessibilityRole="button" onPress={chooseFromLibrary} hitSlop={10} accessibilityLabel="Choisir dans la galerie">
            <Ionicons name="image-outline" size={34} color={C.cream} />
          </Pressable>

          <Pressable accessibilityRole="button"
            onPress={capture}
            style={styles.shutter}
            accessibilityLabel={photoUri ? "Reprendre la photo" : "Prendre la photo"}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable accessibilityRole="button"
            onPress={flipOrRetake}
            hitSlop={10}
            accessibilityLabel={photoUri ? "Reprendre la photo" : "Changer de caméra"}
          >
            <Ionicons name="sync-outline" size={34} color={C.cream} />
          </Pressable>
        </View>
      </View>

      {/* Pas de promesse quand l'analyse est impossible ou que la photo est refusée : le message de vérification parle seul. */}
      {verification?.statut === "impossible" || verification?.statut === "refusee" ? null : <Text style={styles.astuce}>{MESSAGE_ASTUCE_PHOTO}</Text>}

      {verification ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.verification, { borderColor: couleurVerification(verification.statut, P) }]}
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
            color={couleurVerification(verification.statut, P)}
          />
          <Text style={[styles.verificationText, { color: couleurVerification(verification.statut, P) }]}>
            {verification.message}
          </Text>
        </View>
      ) : null}

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Passer la photo" style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Passer</Text>
        </Pressable>
        <Pressable accessibilityRole="button"
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

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.background,
  },
  header: {
    backgroundColor: P.header,
    paddingHorizontal: 24,
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
    color: P.onHeader,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: CAMERA.clair,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8,
  },
  cameraCard: {
    flex: 1,
    marginTop: -40,
    marginHorizontal: 0,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: C.dark,
  },
  preview: {
    flex: 1,
    backgroundColor: CAMERA.noir,
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
  flashAllume: { backgroundColor: C.cream },
  flashInactif: { opacity: 0.4 },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  permissionText: {
    color: C.cream,
    fontSize: 15,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: P.action,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
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
  astuce: { marginHorizontal: 16, marginTop: 12, fontSize: 14, lineHeight: 20, fontWeight: "600", color: P.textSecondary },
  verification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
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
    backgroundColor: P.backgroundSelected,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    color: P.primary,
    fontWeight: "800",
    fontSize: 18,
  },
  continueButton: {
    flex: 1.4,
    height: 60,
    backgroundColor: P.action,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: P.onAction,
    fontSize: 20,
    fontWeight: "800",
  },
});
