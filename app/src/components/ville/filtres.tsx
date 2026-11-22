import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES_TOUTES, LIBELLES_CATEGORIE, LIBELLES_ETAT, type Categorie, type Etat } from '@/types';

import { CIBLE_MIN } from './style';

const ETATS: Etat[] = ['nouveau', 'pris_en_charge', 'regle', 'rejete'];
const CATEGORIES: Categorie[] = CATEGORIES_TOUTES;

function basculer<T>(liste: T[], v: T): T[] {
  return liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];
}

type Props = {
  etats: Etat[];
  categories: Categorie[];
  onEtats: (e: Etat[]) => void;
  onCategories: (c: Categorie[]) => void;
};

/** Filtres compacts : une rangée de pastilles ; chacune ouvre une liste de choix (plusieurs possibles) en bas de l'écran. */
export function Filtres({ etats, categories, onEtats, onCategories }: Props) {
  const theme = useTheme();
  const actifs = etats.length + categories.length;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
      <Ionicons name="options-outline" size={20} color={theme.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      <Pastille
        titre="État"
        options={ETATS}
        libelles={LIBELLES_ETAT}
        choisis={etats}
        onBasculer={(e) => onEtats(basculer(etats, e))}
        onTout={() => onEtats([])}
      />
      <Pastille
        titre="Catégorie"
        options={CATEGORIES}
        libelles={LIBELLES_CATEGORIE}
        choisis={categories}
        onBasculer={(c) => onCategories(basculer(categories, c))}
        onTout={() => onCategories([])}
      />
      {actifs > 0 ? (
        <Pressable
          onPress={() => {
            onEtats([]);
            onCategories([]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Effacer les filtres"
          hitSlop={8}
          style={styles.effacer}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.souligne}>
            Effacer
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Pastille<T extends string>({
  titre,
  options,
  libelles,
  choisis,
  onBasculer,
  onTout,
}: {
  titre: string;
  options: T[];
  libelles: Record<T, string>;
  choisis: T[];
  onBasculer: (v: T) => void;
  onTout: () => void;
}) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);
  const actif = choisis.length > 0;
  const resume = !actif ? titre : choisis.length === 1 ? libelles[choisis[0]] : `${titre} · ${choisis.length}`;

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel={`Filtrer par ${titre.toLowerCase()} : ${actif ? choisis.map((c) => libelles[c]).join(', ') : 'tous'}`}
        hitSlop={4}
        style={[
          styles.pastille,
          { borderColor: actif ? theme.text : theme.border, backgroundColor: actif ? theme.backgroundSelected : 'transparent' },
        ]}>
        <ThemedText type={actif ? 'smallBold' : 'small'} numberOfLines={1} style={styles.pastilleTexte}>
          {resume}
        </ThemedText>
        <Ionicons name="chevron-down" size={14} color={theme.text} />
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)} accessibilityLabel="Fermer" />
        <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
          <View style={styles.feuilleEntete}>
            <ThemedText type="subtitle" accessibilityRole="header" style={styles.feuilleTitre}>
              {titre}
            </ThemedText>
            <Pressable onPress={() => setOuvert(false)} accessibilityRole="button" accessibilityLabel="Terminé" hitSlop={8}>
              <ThemedText type="smallBold">Terminé</ThemedText>
            </Pressable>
          </View>
          <Option libelle="Tous" coche={!actif} onPress={onTout} />
          {options.map((o) => (
            <Option key={o} libelle={libelles[o]} coche={choisis.includes(o)} onPress={() => onBasculer(o)} />
          ))}
        </View>
      </Modal>
    </>
  );
}

function Option({ libelle, coche, onPress }: { libelle: string; coche: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: coche }}
      accessibilityLabel={libelle}
      style={[styles.option, { borderBottomColor: theme.border }]}>
      <ThemedText type={coche ? 'smallBold' : 'default'}>{libelle}</ThemedText>
      <Ionicons name={coche ? 'checkbox' : 'square-outline'} size={22} color={coche ? theme.text : theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastille: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  pastilleTexte: { maxWidth: 160 },
  effacer: { paddingHorizontal: 4, paddingVertical: 6 },
  souligne: { textDecorationLine: 'underline' },
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.3)' },
  feuille: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  feuilleEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  feuilleTitre: { fontSize: 20 },
  option: {
    minHeight: CIBLE_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
});
