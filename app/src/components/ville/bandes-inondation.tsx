import { Trace } from '@/components/carte';
import type { BandeEau } from '@/lib/inondation';

import { COULEUR_BANDE_EAU, EPAISSEUR_BANDE_EAU } from './style';

/** Bande bleue semi-transparente le long de la rue touchée par de l'eau accumulée, sans liseré (les avis officiels en ont un). */
export function BandesInondation({ bandes }: { bandes: BandeEau[] }) {
  return (
    <>
      {bandes.flatMap((b) =>
        b.traces.map((points, i) => <Trace key={`${b.id}-${i}`} id={`${b.id}-${i}`} points={points} couleur={COULEUR_BANDE_EAU} epaisseur={EPAISSEUR_BANDE_EAU} />),
      )}
    </>
  );
}
