import { StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterDate, libelleNombreEndroit } from '@/lib/format';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, LIBELLES_GRAVITE, type Endroit, type Etat } from '@/types';

import { EtiquetteGravite, EtiquetteNeutre } from './etiquette';
import { CIBLE_MIN } from './style';

export function ligneRecente(e: Endroit): string {
  const plus = e.signalements.reduce((m, s) => (s.cree_le > m ? s.cree_le : m), '');
  return formaterDate(plus);
}

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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[endroit.gravite_affichee]}, état ${etat}, ${LIBELLES_CATEGORIE[premier.categorie]}. Ouvrir.`}
      style={({ pressed }) => [
        styles.ligne,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={styles.entete}>
        <EtiquetteGravite gravite={endroit.gravite_affichee} />
        <ThemedText type="smallBold">{nombre}</ThemedText>
      </View>
      <ThemedText>{LIBELLES_CATEGORIE[premier.categorie]}</ThemedText>
      <View style={styles.pied}>
        <EtiquetteNeutre texte={etat} />
        <EtiquetteNeutre texte={ligneRecente(endroit)} />
        {exemple ? <EtiquetteNeutre texte="Exemple de démo" /> : null}
        {attente ? <EtiquetteNeutre texte="En attente d'envoi" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: { minHeight: CIBLE_MIN, padding: 16, borderRadius: 16, gap: 8 },
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pied: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
