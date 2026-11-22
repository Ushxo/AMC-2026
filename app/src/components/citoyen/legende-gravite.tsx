import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';
import { LIBELLES_GRAVITE, type Gravite } from '@/types';

const ORDRE: Gravite[] = ['faible', 'moyenne', 'elevee'];

/** Légende de la gravité des repères : la couleur est toujours doublée du mot (la couleur seule ne porte pas l'information). */
export function LegendeGravite() {
  const styles = useStyles(creerStyles);
  return (
    <View accessible accessibilityLabel="Gravité des repères : faible en vert, moyenne en orange, élevée en rouge" style={styles.legende}>
      {ORDRE.map((g) => (
        <View key={g} style={styles.item}>
          <View style={[styles.pastille, { backgroundColor: COULEUR_REPERE[g] }]} />
          <ThemedText style={styles.texte} maxFontSizeMultiplier={1.3}>
            {LIBELLES_GRAVITE[g]}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    legende: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: P.background, borderWidth: 1, borderColor: P.border },
    item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pastille: { width: 12, height: 12, borderRadius: 6 },
    texte: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: P.text },
  });
