import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LIBELLES_GRAVITE, type Gravite } from '@/types';

import { COULEUR_GRAVITE } from './style';

export function EtiquetteGravite({ gravite }: { gravite: Gravite }) {
  return (
    <View
      style={[styles.etiquette, { backgroundColor: COULEUR_GRAVITE[gravite] }]}
      accessible
      accessibilityLabel={`Gravité ${LIBELLES_GRAVITE[gravite]}`}>
      <ThemedText type="smallBold" style={styles.blanc}>
        {LIBELLES_GRAVITE[gravite]}
      </ThemedText>
    </View>
  );
}

export function EtiquetteNeutre({ texte }: { texte: string }) {
  return (
    <View style={styles.neutre} accessible accessibilityLabel={texte}>
      <ThemedText type="small" themeColor="textSecondary">
        {texte}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  blanc: { color: '#ffffff' },
  neutre: { paddingVertical: 2, alignSelf: 'flex-start' },
});
