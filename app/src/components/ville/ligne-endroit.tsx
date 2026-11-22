import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterDate, libelleNombreEndroit } from '@/lib/format';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, LIBELLES_GRAVITE, type Categorie, type Endroit, type Etat } from '@/types';

import { SmallIllustration } from '../../../frontend/supervisor/ui';
import type { AlertKind } from '../../../frontend/types/models';
import { CIBLE_MIN, COULEUR_GRAVITE } from './style';

export function ligneRecente(e: Endroit): string {
  const plus = e.signalements.reduce((m, s) => (s.cree_le > m ? s.cree_le : m), '');
  return formaterDate(plus);
}

// Illustration dessinée quand elle existe pour la catégorie, sinon une icône sur fond teinté.
const ILLUSTRATIONS: Partial<Record<Categorie, AlertKind>> = {
  grille_bouchee: 'Égout bouché',
  eau_accumulee: 'Eau accumulée',
  affaissement: 'Feuilles',
  grille_endommagee: 'Autre',
  autre: 'Autre',
};
const ICONES: Record<Categorie, keyof typeof Ionicons.glyphMap> = {
  grille_bouchee: 'grid-outline',
  eau_accumulee: 'water-outline',
  affaissement: 'trending-down-outline',
  grille_endommagee: 'construct-outline',
  eau_douteuse: 'flask-outline',
  absence_eau: 'close-circle-outline',
  autre: 'warning-outline',
};

export function LigneEndroit({
  endroit,
  onPress,
  etatsFiltres = [],
}: {
  endroit: Endroit;
  onPress: () => void;
  etatsFiltres?: Etat[];
}) {
  const theme = useTheme();
  const premier = endroit.signalements[0];
  const exemple = endroit.signalements.some((s) => s.exemple_demo);
  const attente = endroit.signalements.some((s) => s.en_attente);
  const nombre = libelleNombreEndroit(endroit, etatsFiltres);
  const etat = LIBELLES_ETAT[endroit.etat_dominant];
  const gravite = endroit.gravite_affichee;
  const couleur = COULEUR_GRAVITE[gravite];
  const illustration = ILLUSTRATIONS[premier.categorie];
  const extras = [exemple ? 'Exemple de démo' : null, attente ? "En attente d'envoi" : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[gravite]}, état ${etat}, ${LIBELLES_CATEGORIE[premier.categorie]}. Ouvrir.`}
      style={({ pressed }) => [
        styles.carte,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: couleur + (gravite === 'elevee' ? '59' : '26'),
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {/* Code discret de gravité : fine barre de couleur sur le bord gauche. */}
      <View style={[styles.barre, { backgroundColor: couleur }]} />

      {illustration ? (
        <SmallIllustration kind={illustration} scale={0.62} />
      ) : (
        <View style={[styles.tuile, { backgroundColor: couleur + '1A' }]}>
          <Ionicons name={ICONES[premier.categorie]} size={30} color={couleur} />
        </View>
      )}

      <View style={styles.texte}>
        <ThemedText type="smallBold" style={styles.titre}>
          {LIBELLES_CATEGORIE[premier.categorie]}
        </ThemedText>
        <View style={styles.rangee}>
          <Ionicons name="location-outline" size={15} color={theme.text} />
          <ThemedText type="small" style={styles.flexible} numberOfLines={1}>
            {nombre}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {etat} · {ligneRecente(endroit)}
        </ThemedText>
        {extras ? (
          <ThemedText type="small" themeColor="textSecondary">
            {extras}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    minHeight: CIBLE_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#1A261A',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  barre: { width: 5, alignSelf: 'stretch', borderRadius: 3, marginVertical: 4 },
  tuile: { width: 64, height: 57, marginHorizontal: 5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 3 },
  titre: { fontSize: 15 },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flexible: { flexShrink: 1 },
});
