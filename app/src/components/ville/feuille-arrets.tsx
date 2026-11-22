import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterNombre } from '@/lib/format';
import { formaterHeure } from '@/lib/temps';
import type { Arret } from '@/types';

import { Bouton } from './bouton';

type Props = { visible: boolean; arrets: Arret[]; onFermer: () => void };

/** Liste des arrêts restants, en feuille au bas de l'écran (ouverte depuis la barre de navigation). */
export function FeuilleArrets({ visible, arrets, onFermer }: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable retour={false} style={styles.fond} onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer la liste" />
      <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
        <FlatList
          data={arrets}
          keyExtractor={(a) => String(a.id ?? a.cle_endroit)}
          contentContainerStyle={styles.contenu}
          initialNumToRender={15}
          windowSize={7}
          ListHeaderComponent={
            <ThemedText type="subtitle" accessibilityRole="header">
              Arrêts restants ({arrets.length})
            </ThemedText>
          }
          renderItem={({ item: a }) => {
            const n = formaterNombre(a.signalement_ids.length, 'signalement', 'signalements');
            return (
              <ThemedText type="small" accessibilityLabel={`Arrêt ${a.rang}, passage prévu à ${formaterHeure(a.arrivee_prevue)}, ${n}`}>
                {a.rang}. {formaterHeure(a.arrivee_prevue)} · {n}
              </ThemedText>
            );
          }}
          ListFooterComponent={<Bouton titre="Fermer" variante="discret" pleineLargeur onPress={onFermer} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  feuille: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  contenu: { padding: 20, gap: 8 },
});
