// ÉCRAN DE TEST du modèle ML (temporaire, en attendant le vrai UI du frontend).
// Page 1 : caméra. On prend une photo (ou on en choisit une dans la galerie),
// puis « Continuer » envoie la photo au serveur ML (page résultat).

import type { CameraType, FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraView, useCameraPermissions, type VueCamera } from '@/lib/camera-optionnelle';
import { reveillerServeurML } from '@/lib/ml';

const ORANGE = '#EE6A1F';
const BEIGE = '#E8E6DA';
const FOND = '#F7F4EC';
const BARRE = '#2A2724';

export default function EcranCamera() {
  const router = useRouter();
  const camera = useRef<VueCamera>(null);
  const [permission, demanderPermission] = useCameraPermissions();
  const [cote, setCote] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [photo, setPhoto] = useState<string | null>(null);
  const [capture, setCapture] = useState(false);

  // Réveille le serveur Cloud Run pendant que l'utilisateur cadre sa photo.
  useEffect(() => {
    reveillerServeurML();
  }, []);

  async function prendrePhoto() {
    if (photo) {
      setPhoto(null); // deuxième appui : on reprend une photo
      return;
    }
    if (!camera.current || capture) return;
    setCapture(true);
    try {
      const resultat = await camera.current.takePictureAsync({ quality: 0.7 });
      if (resultat?.uri) setPhoto(resultat.uri);
    } finally {
      setCapture(false);
    }
  }

  async function choisirDansGalerie() {
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!resultat.canceled) setPhoto(resultat.assets[0].uri);
  }

  function continuer() {
    if (photo) router.push({ pathname: '/resultat', params: { photo } });
  }

  return (
    <SafeAreaView style={styles.ecran}>
      <View style={styles.carte}>
        <View style={styles.cadre}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : CameraView && permission?.granted ? (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={cote}
              flash={flash}
            />
          ) : (
            <View style={styles.permission}>
              <Text style={styles.permissionTexte}>
                {CameraView
                  ? 'L’app a besoin de la caméra pour photographier l’égout.'
                  : 'La caméra intégrée n’est pas disponible dans cette version de l’app : choisissez une photo dans la galerie.'}
              </Text>
              <Pressable style={styles.boutonPermission} onPress={demanderPermission}>
                <Text style={styles.texteContinuer}>Autoriser la caméra</Text>
              </Pressable>
            </View>
          )}

          <Coins />

          {!photo && permission?.granted && (
            <Pressable
              style={[styles.flash, flash === 'on' && styles.flashActif]}
              onPress={() => setFlash(flash === 'on' ? 'off' : 'on')}
              accessibilityLabel={flash === 'on' ? 'Désactiver le flash' : 'Activer le flash'}>
              <Text style={styles.icone}>⚡</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.barre}>
          <Pressable style={styles.petitBouton} onPress={choisirDansGalerie} accessibilityLabel="Choisir dans la galerie">
            <Text style={styles.icone}>🖼</Text>
          </Pressable>

          <Pressable
            style={styles.declencheur}
            onPress={prendrePhoto}
            disabled={!photo && !permission?.granted}
            accessibilityLabel={photo ? 'Reprendre une photo' : 'Prendre la photo'}>
            {capture ? (
              <ActivityIndicator color={BARRE} />
            ) : (
              <View style={[styles.declencheurInterieur, photo && styles.declencheurReprendre]}>
                {photo && <Text style={styles.reprendre}>↺</Text>}
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.petitBouton}
            onPress={() => setCote(cote === 'back' ? 'front' : 'back')}
            disabled={!!photo}
            accessibilityLabel="Changer de caméra">
            <Text style={[styles.icone, !!photo && styles.inactif]}>⟳</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.bouton, styles.passer]} onPress={() => setPhoto(null)}>
          <Text style={styles.textePasser}>Passer</Text>
        </Pressable>
        <Pressable
          style={[styles.bouton, styles.continuer, !photo && styles.desactive]}
          onPress={continuer}
          disabled={!photo}>
          <Text style={styles.texteContinuer}>Continuer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Les 4 coins blancs du viseur. */
function Coins() {
  return (
    <View style={styles.viseur} pointerEvents="none">
      <View style={[styles.coin, styles.hautGauche]} />
      <View style={[styles.coin, styles.hautDroite]} />
      <View style={[styles.coin, styles.basGauche]} />
      <View style={[styles.coin, styles.basDroite]} />
    </View>
  );
}

const COIN = 36;

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: FOND, padding: 16, gap: 16 },
  carte: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: BARRE },
  cadre: { flex: 1, backgroundColor: '#111' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permissionTexte: { color: 'white', fontSize: 16, textAlign: 'center' },
  boutonPermission: { backgroundColor: ORANGE, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  viseur: { position: 'absolute', top: 48, left: 48, right: 48, bottom: 48 },
  coin: { position: 'absolute', width: COIN, height: COIN, borderColor: 'white' },
  hautGauche: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  hautDroite: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  basGauche: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  basDroite: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  flash: {
    position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.85)', alignItems: 'center', justifyContent: 'center',
  },
  flashActif: { backgroundColor: ORANGE },
  barre: {
    height: 110, backgroundColor: BARRE, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around',
  },
  petitBouton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  icone: { color: 'white', fontSize: 24 },
  inactif: { opacity: 0.3 },
  declencheur: {
    width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  declencheurInterieur: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#F4EFE6',
    alignItems: 'center', justifyContent: 'center',
  },
  declencheurReprendre: { backgroundColor: '#555' },
  reprendre: { color: 'white', fontSize: 26 },
  actions: { flexDirection: 'row', gap: 12 },
  bouton: { flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  passer: { flex: 0.8, backgroundColor: BEIGE },
  continuer: { flex: 1.2, backgroundColor: ORANGE },
  desactive: { opacity: 0.45 },
  textePasser: { color: '#2A2724', fontSize: 17, fontWeight: '600' },
  texteContinuer: { color: 'white', fontSize: 18, fontWeight: '700' },
});
