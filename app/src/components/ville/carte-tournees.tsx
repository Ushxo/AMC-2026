import { StyleSheet } from 'react-native';
import { Circle, Marker, Polyline, type MapPressEvent } from 'react-native-maps';

import { CarteCommune } from './carte-commune';
import { MarqueurEgout } from './marqueur-egout';
import { LIBELLES_INCIDENT, type Equipe, type ResultatOptimisation } from '@/types';
import { formaterHeure } from '@/lib/temps';
import { pointsTournee } from '@/lib/tournees';
import type { Region } from '@/lib/config';

import { COULEUR_INCIDENT, couleurEquipe, FOND_INCIDENT } from './style';

type Props = {
  resultat: ResultatOptimisation;
  equipes: Equipe[];
  region: Region;
  choisi: { latitude: number; longitude: number } | null;
  onToucherCarte?: (e: MapPressEvent) => void;
  equipeActive?: string | null;
};

/** Une couleur par équipe : tracé, repères d'arrêts. Les incidents sont des cercles. */
export function CarteTournees({ resultat, equipes, region, choisi, onToucherCarte, equipeActive }: Props) {
  return (
    <CarteCommune
      style={styles.carte}
      initialRegion={region}
      onPress={onToucherCarte}
      accessibilityLabel="Carte des tournées par équipe">
      {resultat.tournees.map((t, i) => {
        if (equipeActive && equipeActive !== t.equipe_id) return null;
        const couleur = couleurEquipe(i);
        const garage = equipes.find((e) => e?.id === t.equipe_id)?.garage ?? null;
        return (
          <Polyline key={`l-${t.equipe_id}`} coordinates={pointsTournee(t, garage)} strokeColor={couleur} strokeWidth={4} />
        );
      })}
      {resultat.tournees.flatMap((t, i) =>
        equipeActive && equipeActive !== t.equipe_id
          ? []
          : t.arrets.map((a) => (
              <MarqueurEgout
                key={`${t.equipe_id}-${a.rang}`}
                coordinate={a.position}
                couleur={couleurEquipe(i)}
                title={`${t.equipe_nom}, arrêt ${a.rang}`}
                description={`Passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
                accessibilityLabel={`${t.equipe_nom}, arrêt ${a.rang}, passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
              />
            )),
      )}
      {resultat.incidents.map((inc) => (
        <Circle
          key={inc.id}
          center={inc.position}
          radius={inc.rayon_m}
          strokeColor={COULEUR_INCIDENT}
          fillColor={FOND_INCIDENT}
          strokeWidth={2}
        />
      ))}
      {resultat.incidents.map((inc) => (
        <Marker
          key={`m-${inc.id}`}
          coordinate={inc.position}
          title={`${LIBELLES_INCIDENT[inc.type]} (simulé)`}
          accessibilityLabel={`${LIBELLES_INCIDENT[inc.type]}, incident simulé`}
        />
      ))}
      {choisi ? <Marker coordinate={choisi} title="Position de l'incident" /> : null}
    </CarteCommune>
  );
}

const styles = StyleSheet.create({
  carte: { height: 360, borderRadius: 14 },
});
