import { StyleSheet } from 'react-native';

import { Carte, Cercle, Repere, Trace, Vehicule } from '@/components/carte';
import { formaterHeure } from '@/lib/temps';
import { distanceM } from '@/lib/geo';
import { cibleFinTournee, pointsTournee } from '@/lib/tournees';
import type { Region } from '@/lib/config';
import { LIBELLES_INCIDENT, type Coordonnees, type Equipe, type PositionEquipe, type ResultatOptimisation } from '@/types';

import { COULEUR_INCIDENT, COULEUR_REPERE, couleurEquipe, FOND_INCIDENT } from './style';

type Props = {
  resultat: ResultatOptimisation;
  equipes: Equipe[];
  region: Region;
  choisi: Coordonnees | null;
  onToucherCarte?: (c: Coordonnees) => void;
  equipeActive?: string | null;
  /** Dernière position de chaque équipe (superviseur). */
  vehicules?: PositionEquipe[];
};

/** Une couleur par équipe : tracé, repères d'arrêts. Les incidents sont des cercles. */
export function CarteTournees({ resultat, equipes, region, choisi, onToucherCarte, equipeActive, vehicules = [] }: Props) {
  return (
    <Carte
      style={styles.carte}
      regionInitiale={region}
      onPress={onToucherCarte}
      accessibilityLabel="Carte des tournées par équipe">
      {resultat.tournees.map((t, i) => {
        if (equipeActive && equipeActive !== t.equipe_id) return null;
        const equipeT = equipes.find((e) => e?.id === t.equipe_id);
        const garage = equipeT?.garage ?? null;
        return <Trace key={`l-${t.equipe_id}`} id={`tournee-${t.equipe_id}`} points={pointsTournee(t, garage, equipeT?.arrivee)} couleur={couleurEquipe(i)} epaisseur={4} />;
      })}
      {resultat.tournees.flatMap((t, i) =>
        equipeActive && equipeActive !== t.equipe_id
          ? []
          : t.arrets.map((a) => (
              <Repere
                key={`${t.equipe_id}-${a.rang}`}
                id={`arret-${t.equipe_id}-${a.rang}`}
                position={a.position}
                couleur={couleurEquipe(i)}
                titre={`${t.equipe_nom}, arrêt ${a.rang}`}
                description={`Passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
                accessibilityLabel={`${t.equipe_nom}, arrêt ${a.rang}, passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
              />
            )),
      )}
      {resultat.tournees.flatMap((t, i) => {
        if (equipeActive && equipeActive !== t.equipe_id) return [];
        const equipe = equipes.find((e) => e?.id === t.equipe_id);
        const garage = equipe?.garage ?? null;
        const depart = t.depart === 'position' && t.depart_position ? t.depart_position : garage;
        const arrivee = cibleFinTournee(t, garage, equipe?.arrivee)?.position ?? null;
        const memeEndroit = !!depart && !!arrivee && distanceM(depart, arrivee) < 10;
        const marqueurs = [];
        if (depart) {
          const adresseDepart = t.depart === 'position' ? 'position de l’équipe' : (equipe?.garage_adresse ?? 'garage');
          marqueurs.push(
            <Repere
              key={`depart-${t.equipe_id}`}
              id={`depart-${t.equipe_id}`}
              position={depart}
              couleur={couleurEquipe(i)}
              etat="prochain"
              zIndex={4}
              titre={`${t.equipe_nom} : ${memeEndroit ? 'départ et arrivée' : 'départ'}`}
              description={adresseDepart}
              accessibilityLabel={`${t.equipe_nom}, ${memeEndroit ? 'départ et arrivée' : 'départ'} : ${adresseDepart}`}
            />,
          );
        }
        if (arrivee && !memeEndroit) {
          const adresseArrivee = t.fin === 'arrivee' ? (t.fin_nom ?? equipe?.arrivee_adresse ?? 'adresse d’arrivée') : equipe?.arrivee ? (equipe.arrivee_adresse ?? 'adresse d’arrivée') : t.fin === 'endroit' ? 'endroit choisi' : (equipe?.garage_adresse ?? 'garage');
          marqueurs.push(
            <Repere
              key={`arrivee-${t.equipe_id}`}
              id={`arrivee-${t.equipe_id}`}
              position={arrivee}
              couleur={couleurEquipe(i)}
              etat="choisi"
              zIndex={4}
              titre={`${t.equipe_nom} : arrivée`}
              description={adresseArrivee}
              accessibilityLabel={`${t.equipe_nom}, arrivée : ${adresseArrivee}`}
            />,
          );
        }
        return marqueurs;
      })}
      {vehicules.map((v) => {
        const nom = resultat.tournees.find((t) => t.equipe_id === v.equipe_id)?.equipe_nom ?? 'Équipe';
        return (
          <Vehicule
            key={`v-${v.equipe_id}`}
            id={v.equipe_id}
            position={v.position}
            cap={v.cap}
            titre={nom}
            description={`Position mise à jour à ${formaterHeure(v.maj_le)}`}
            accessibilityLabel={`${nom}, véhicule, position mise à jour à ${formaterHeure(v.maj_le)}`}
          />
        );
      })}
      {resultat.incidents.map((inc) => (
        <Cercle
          key={inc.id}
          id={`incident-${inc.id}`}
          centre={inc.position}
          rayonM={inc.rayon_m}
          contour={COULEUR_INCIDENT}
          fond={FOND_INCIDENT}
          epaisseur={2}
        />
      ))}
      {resultat.incidents.map((inc) => (
        <Repere
          key={`m-${inc.id}`}
          id={`incident-repere-${inc.id}`}
          position={inc.position}
          couleur={COULEUR_REPERE.elevee}
          etat="choisi"
          titre={`${LIBELLES_INCIDENT[inc.type]} (simulé)`}
          accessibilityLabel={`${LIBELLES_INCIDENT[inc.type]}, incident simulé`}
        />
      ))}
      {choisi ? <Repere id="point-incident" position={choisi} couleur={COULEUR_REPERE.elevee} etat="prochain" titre="Position de l'incident" /> : null}
    </Carte>
  );
}

const styles = StyleSheet.create({
  carte: { height: 360 },
});
