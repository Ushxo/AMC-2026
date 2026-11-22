import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, type Categorie, type Etat } from '@/types';

import { Bouton } from './bouton';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];
const CATEGORIES: Categorie[] = ['grille_bouchee', 'eau_accumulee', 'eau_douteuse', 'absence_eau', 'autre'];

function basculer<T>(liste: T[], v: T): T[] {
  return liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];
}

type Props = {
  etats: Etat[];
  categories: Categorie[];
  onEtats: (e: Etat[]) => void;
  onCategories: (c: Categorie[]) => void;
};

export function Filtres({ etats, categories, onEtats, onCategories }: Props) {
  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Filtrer par état
      </ThemedText>
      <View style={styles.rangee}>
        {ETATS.map((e) => (
          <Bouton
            key={e}
            titre={LIBELLES_ETAT[e]}
            variante="discret"
            selectionne={etats.includes(e)}
            onPress={() => onEtats(basculer(etats, e))}
          />
        ))}
      </View>
      <ThemedText type="smallBold" accessibilityRole="header">
        Filtrer par catégorie
      </ThemedText>
      <View style={styles.rangee}>
        {CATEGORIES.map((c) => (
          <Bouton
            key={c}
            titre={LIBELLES_CATEGORIE[c]}
            variante="discret"
            selectionne={categories.includes(c)}
            onPress={() => onCategories(basculer(categories, c))}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
