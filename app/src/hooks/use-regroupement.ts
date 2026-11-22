import { useCallback, useMemo, useRef, useState } from 'react';

import type { Region } from '../lib/config';
import { niveauStable, regrouper, type Regroupement } from '../lib/regroupement';
import type { Endroit } from '../types';

type Etat = { region: Region; niveau: number | null };

/** Écart du centre (en part de la zone visible) en dessous duquel un déplacement ne change pas le regroupement. */
const SEUIL_DEPLACEMENT = 0.08;
/** Variation de l'étendue visible (en part) en dessous de laquelle on ne recalcule pas. */
const SEUIL_ETENDUE = 0.03;

/**
 * Regroupe les endroits par secteur selon la zone visible et la taille de la carte (à brancher sur la carte).
 * Aucun recalcul (ni rendu) tant que le niveau de regroupement et la zone visible n'ont pas vraiment changé ;
 * hystérésis sur le niveau pour ne pas osciller à la limite entre deux niveaux.
 */
export function useRegroupement(
  endroits: Endroit[],
  regionInitiale: Region,
  hauteurInitiale = 360,
): { regroupement: Regroupement; surRegion: (r: Region) => void; surTaille: (t: { largeur: number; hauteur: number }) => void } {
  const [etat, setEtat] = useState<Etat>({ region: regionInitiale, niveau: null });
  const [hauteur, setHauteur] = useState(hauteurInitiale);
  const dernier = useRef<Etat>(etat);
  const hauteurCourante = useRef(hauteurInitiale);

  const regroupement = useMemo(
    () => regrouper(endroits, etat.region, hauteur, etat.niveau ?? undefined),
    [endroits, etat, hauteur],
  );

  const surRegion = useCallback((r: Region) => {
    const avant = dernier.current;
    const niveau = niveauStable(avant.niveau, r.latitudeDelta, hauteurCourante.current);
    const memeNiveau = niveau === avant.niveau;
    const ancienne = avant.region;
    const deplacement = Math.max(
      Math.abs(r.latitude - ancienne.latitude) / Math.max(ancienne.latitudeDelta, 1e-9),
      Math.abs(r.longitude - ancienne.longitude) / Math.max(ancienne.longitudeDelta, 1e-9),
    );
    const etendue = Math.abs(r.latitudeDelta - ancienne.latitudeDelta) / Math.max(ancienne.latitudeDelta, 1e-9);
    if (memeNiveau && deplacement < SEUIL_DEPLACEMENT && etendue < SEUIL_ETENDUE) return;
    const suivant = { region: r, niveau };
    dernier.current = suivant;
    setEtat(suivant);
  }, []);
  const surTaille = useCallback((t: { largeur: number; hauteur: number }) => {
    hauteurCourante.current = t.hauteur;
    setHauteur(t.hauteur);
  }, []);
  return { regroupement, surRegion, surTaille };
}
