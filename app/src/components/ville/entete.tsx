import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { CIBLE_MIN } from './style';

type Props = {
  options: { title?: string };
  back?: unknown;
  navigation: { goBack: () => void };
};

/**
 * En-tête commun : titre et bouton « Retour ». Il est posé au-dessus du contenu (pas en transparence),
 * dans la zone sûre : aucun bouton de l'écran ne passe dessous, sur tous les iPhone.
 */
export function Entete({ options, back, navigation }: Props) {
  const theme = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={[styles.barre, { paddingTop: top, backgroundColor: theme.background, borderBottomColor: theme.backgroundSelected }]}>
      <View style={styles.rangee}>
        {back ? (
          <Pressable
            onPress={navigation.goBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={8}
            style={styles.retour}>
            <ThemedText type="smallBold" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              ‹ Retour
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.retour} />
        )}
        <ThemedText
          type="smallBold"
          accessibilityRole="header"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
          style={styles.titre}>
          {options.title ?? ''}
        </ThemedText>
        <View style={styles.retour} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { borderBottomWidth: StyleSheet.hairlineWidth },
  rangee: { minHeight: CIBLE_MIN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  retour: { minWidth: 96, minHeight: CIBLE_MIN, justifyContent: 'center', paddingHorizontal: 8 },
  titre: { flex: 1, textAlign: 'center' },
});
