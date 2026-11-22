import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, type MapMarkerProps } from 'react-native-maps';

import { BLANC_FIXE, COULEURS_INFO, ICONES_INFO, type GenreInfoCarte } from './style';

type Props = Omit<MapMarkerProps, 'children' | 'tracksViewChanges' | 'anchor' | 'centerOffset'> & { genre: GenreInfoCarte };

const DUREE_SUIVI_MS = 700;
const TAILLE = 28;

/** Petit repère d'information (avis, eau accumulée, chantier, zone inondable) : pastille ronde de la couleur du genre, icône blanche. */
export function MarqueurInfo({ genre, ...reste }: Props) {
  const [suit, setSuit] = useState(true);
  useEffect(() => {
    const relance = setTimeout(() => setSuit(true), 0);
    const arret = setTimeout(() => setSuit(false), DUREE_SUIVI_MS);
    return () => {
      clearTimeout(relance);
      clearTimeout(arret);
    };
  }, [genre]);
  return (
    <Marker {...reste} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={suit}>
      <View style={[styles.pastille, { backgroundColor: COULEURS_INFO[genre] }]}>
        <Ionicons name={ICONES_INFO[genre]} size={16} color={BLANC_FIXE} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pastille: { width: TAILLE, height: TAILLE, borderRadius: TAILLE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BLANC_FIXE },
});
