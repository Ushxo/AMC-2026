import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, type Categorie, type Etat, type ResumeVille } from '@/types';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];
const CATEGORIES: Categorie[] = ['grille_bouchee', 'eau_accumulee', 'eau_douteuse', 'absence_eau', 'autre'];

export function Resume({ resume }: { resume: ResumeVille }) {
  const theme = useTheme();
  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Par état
      </ThemedText>
      <View style={styles.rangee}>
        {ETATS.map((e) => (
          <View
            key={e}
            style={[styles.case, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityLabel={`${LIBELLES_ETAT[e]} : ${resume.parEtat[e]}`}>
            <ThemedText type="subtitle" style={styles.chiffre}>
              {resume.parEtat[e]}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {LIBELLES_ETAT[e]}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="smallBold" accessibilityRole="header">
        Par catégorie
      </ThemedText>
      <View style={styles.rangee}>
        {CATEGORIES.map((c) => (
          <View
            key={c}
            style={[styles.case, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityLabel={`${LIBELLES_CATEGORIE[c]} : ${resume.parCategorie[c]}`}>
            <ThemedText type="subtitle" style={styles.chiffre}>
              {resume.parCategorie[c]}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {LIBELLES_CATEGORIE[c]}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  case: { minWidth: 96, flexGrow: 1, padding: 12, borderRadius: 12, gap: 2 },
  chiffre: { fontSize: 28, lineHeight: 34 },
});
