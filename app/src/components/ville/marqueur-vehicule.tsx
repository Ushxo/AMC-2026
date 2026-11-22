import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Marker, type MapMarkerProps } from 'react-native-maps';

import { IconeVehicule } from './icone-vehicule';

type Props = Omit<MapMarkerProps, 'children' | 'tracksViewChanges' | 'anchor' | 'centerOffset' | 'rotation' | 'flat'> & {
  /** Cap en degrés (0 = nord). */
  cap: number | null;
};

/** Repère du véhicule : l'icône est tournée selon le cap par la carte (rotation), dessinée une seule fois. */
export function MarqueurVehicule({ cap, ...reste }: Props) {
  const [suit, setSuit] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSuit(false), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker {...reste} anchor={{ x: 0.5, y: 0.5 }} flat rotation={cap ?? 0} tracksViewChanges={suit} zIndex={5}>
      <View>
        <IconeVehicule />
      </View>
    </Marker>
  );
}
