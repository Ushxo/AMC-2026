import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { COULEUR_ACCENT } from './style';

type Props = {
  /** « Arrêt 3 sur 41 · 350 m · environ 2 min » */
  titre: string;
  detail?: string | null;
  avertissement?: string | null;
};

/** Bandeau du haut façon navigation : où on va, à quelle distance, en combien de temps. */
export function BandeauNavigation({ titre, detail, avertissement }: Props) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[titre, detail, avertissement].filter(Boolean).join('. ')}
      accessibilityLiveRegion="polite"
      style={[styles.bandeau, { backgroundColor: theme.backgroundElement, borderLeftColor: COULEUR_ACCENT }]}>
      <ThemedText type="smallBold">{titre}</ThemedText>
      {detail ? <ThemedText type="small">{detail}</ThemedText> : null}
      {avertissement ? (
        <ThemedText type="small" themeColor="textSecondary">
          {avertissement}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { borderRadius: 12, borderLeftWidth: 6, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
