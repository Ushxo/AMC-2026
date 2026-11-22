import type { ReactNode } from 'react';

import { RepereGroupe } from '@/components/carte';
import { etatSelectionGroupe, libelleGroupe, type Regroupement } from '@/lib/regroupement';
import { LIBELLES_GRAVITE, type Coordonnees, type Endroit } from '@/types';

import { COULEUR_REPERE } from './style';

type Props = {
  regroupement: Regroupement;
  /** Repère d'un endroit isolé (ou en dessous du seuil de regroupement). */
  rendreEndroit: (e: Endroit) => ReactNode;
  /** Toucher d'un groupe : on zoome sur son emprise. */
  onZoomer: (points: Coordonnees[]) => void;
  /** Carte de sélection : état de sélection d'un endroit, pour la marque des groupes. */
  estChoisi?: (cle: string) => boolean;
};

/** Repères d'une carte : un repère par endroit isolé, un repère de groupe par secteur (nombre, gravité moyenne). */
export function ReperesEndroits({ regroupement, rendreEndroit, onZoomer, estChoisi }: Props) {
  return (
    <>
      {regroupement.groupes.map((g) => {
        const selection = estChoisi ? etatSelectionGroupe(g, estChoisi) : null;
        return (
          <RepereGroupe
            key={g.id}
            id={g.id}
            position={g.position}
            couleur={COULEUR_REPERE[g.gravite]}
            nombre={g.nombre}
            pointEleve={g.marqueEleve}
            marque={selection === 'tous' ? 'coche' : selection === 'partiel' ? 'tiret' : selection === 'aucun' ? 'aucune' : undefined}
            zIndex={3}
            onPress={() => onZoomer(g.endroits.map((e) => e.position))}
            accessibilityLabel={`${libelleGroupe(g, (x) => LIBELLES_GRAVITE[x])}${selection ? `, ${selection === 'tous' ? 'tous sélectionnés' : selection === 'partiel' ? 'sélection partielle' : 'aucun sélectionné'}` : ''}`}
          />
        );
      })}
      {regroupement.isoles.map((e) => rendreEndroit(e))}
    </>
  );
}
