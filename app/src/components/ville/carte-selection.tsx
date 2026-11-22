import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { Region } from '@/lib/config';
import { formaterNombre } from '@/lib/format';
import { LIBELLES_GRAVITE, type Endroit } from '@/types';

import { CarteCommune } from './carte-commune';
import { MarqueurEgout } from './marqueur-egout';
import { COULEUR_REPERE } from './style';

type Props = {
  endroits: Endroit[];
  region: Region;
  estChoisi: (cle: string) => boolean;
  onBasculer: (cle: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function CarteSelection({ endroits, region, estChoisi, onBasculer, style }: Props) {
  return (
    <CarteCommune style={[styles.carte, style]} initialRegion={region} accessibilityLabel="Carte des endroits à planifier">
      {endroits.map((e) => {
        const choisi = estChoisi(e.cle);
        const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
        return (
          <MarqueurEgout
            key={e.cle}
            coordinate={e.position}
            couleur={COULEUR_REPERE[e.gravite_affichee]}
            etat={choisi ? 'choisi' : 'attenue'}
            onPress={() => onBasculer(e.cle)}
            accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}, ${choisi ? 'sélectionné' : 'non sélectionné'}`}
          />
        );
      })}
    </CarteCommune>
  );
}

const styles = StyleSheet.create({
  carte: { height: 340 },
});
