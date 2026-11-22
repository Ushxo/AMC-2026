import { useEffect, useState } from 'react';
import { Marker, type MapMarkerProps } from 'react-native-maps';

import { geometrieRepere, RepereEgout, type EtatRepere } from './repere-egout';

type Props = Omit<MapMarkerProps, 'children' | 'tracksViewChanges' | 'anchor' | 'centerOffset'> & {
  couleur: string;
  etat?: EtatRepere;
};

const DUREE_SUIVI_MS = 700;

/**
 * Repère de carte : le dessin est capturé une fois, puis la carte arrête de le surveiller
 * (tracksViewChanges coupé : 190 repères restent fluides, avec Apple comme avec Google).
 * Si la couleur ou l'état change, on le redessine brièvement.
 */
export function MarqueurEgout({ couleur, etat = 'normal', ...reste }: Props) {
  const [suit, setSuit] = useState(true);
  const g = geometrieRepere(etat);
  useEffect(() => {
    const relance = setTimeout(() => setSuit(true), 0);
    const arret = setTimeout(() => setSuit(false), DUREE_SUIVI_MS);
    return () => {
      clearTimeout(relance);
      clearTimeout(arret);
    };
  }, [couleur, etat]);
  return (
    // La pointe du repère tombe sur la position : anchor pour Google, centerOffset pour Apple Plans.
    <Marker {...reste} anchor={g.ancre} centerOffset={g.decalage} tracksViewChanges={suit}>
      <RepereEgout couleur={couleur} etat={etat} />
    </Marker>
  );
}
