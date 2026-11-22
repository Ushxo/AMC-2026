import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { useCouleursTexte } from './couleurs';
import { CIBLE_MIN } from './style';

/** Champ de saisie ; `erreur` : ce qu'il faut corriger, affiché juste sous le champ. */
export function Champ({ etiquette, erreur, style, ...rest }: TextInputProps & { etiquette: string; erreur?: string | null }) {
  const theme = useTheme();
  const couleurs = useCouleursTexte();
  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold">{etiquette}</ThemedText>
      <TextInput
        accessibilityLabel={etiquette}
        accessibilityHint={erreur ?? undefined}
        placeholderTextColor={theme.textSecondary}
        style={[styles.champ, { backgroundColor: theme.backgroundElement, color: theme.text }, erreur ? { borderWidth: 2, borderColor: couleurs.erreur } : null, style]}
        {...rest}
      />
      {erreur ? (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: couleurs.erreur }}>
          {erreur}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 4 },
  champ: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
