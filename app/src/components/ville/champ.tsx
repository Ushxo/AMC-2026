import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { CIBLE_MIN } from './style';

export function Champ({ etiquette, ...rest }: TextInputProps & { etiquette: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold">{etiquette}</ThemedText>
      <TextInput
        accessibilityLabel={etiquette}
        placeholderTextColor={theme.textSecondary}
        style={[styles.champ, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 4 },
  champ: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
