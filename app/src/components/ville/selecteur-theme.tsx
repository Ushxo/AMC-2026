import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  definirPreferenceTheme,
  LIBELLES_THEME,
  PREFERENCES,
  usePreferenceTheme,
} from '@/lib/theme-pref';

import { CIBLE_MIN } from './style';

/** Trois boutons côte à côte : Automatique (réglage de l'appareil), Clair, Sombre. */
export function SelecteurTheme() {
  const theme = useTheme();
  const choix = usePreferenceTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Apparence de l'application" style={styles.groupe}>
      <ThemedText type="smallBold">Apparence</ThemedText>
      <View style={[styles.rangee, { backgroundColor: theme.backgroundElement }]}>
        {PREFERENCES.map((p) => {
          const actif = choix === p;
          return (
            <Pressable
              key={p}
              onPress={() => void definirPreferenceTheme(p)}
              accessibilityRole="radio"
              accessibilityLabel={LIBELLES_THEME[p]}
              accessibilityState={{ checked: actif, selected: actif }}
              style={[styles.segment, actif ? { backgroundColor: theme.backgroundSelected } : null]}>
              <ThemedText type={actif ? 'smallBold' : 'small'}>{actif ? `✓ ${LIBELLES_THEME[p]}` : LIBELLES_THEME[p]}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: 6 },
  rangee: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: CIBLE_MIN - 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
