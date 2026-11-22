import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Appuyable } from '@/components/appuyable';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

/**
 * L'action principale d'un écran : grand bouton arrondi de la couleur d'action de la marque (texte lisible garanti par le contraste des jetons).
 * Une seule par écran ; hauteur 60, rayon 30, retour visuel à l'appui.
 */
export function BoutonAction({
  titre,
  onPress,
  actif = true,
  occupe = false,
  libelleAccessible,
  style,
}: {
  titre: string;
  onPress: () => void;
  actif?: boolean;
  occupe?: boolean;
  libelleAccessible?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const desactive = !actif || occupe;
  return (
    <Appuyable
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible ?? titre}
      accessibilityState={{ disabled: desactive, busy: occupe }}
      disabled={desactive}
      onPress={onPress}
      style={[styles.bouton, desactive && { opacity: 0.5 }, style]}>
      <View style={styles.contenu}>
        {occupe ? <ActivityIndicator color={P.onAction} /> : null}
        <ThemedText style={styles.texte} maxFontSizeMultiplier={1.2}>
          {titre}
        </ThemedText>
      </View>
    </Appuyable>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    bouton: { minHeight: 60, borderRadius: 30, backgroundColor: P.action, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    contenu: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    texte: { color: P.onAction, fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  });
