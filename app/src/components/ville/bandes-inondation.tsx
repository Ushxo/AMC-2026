import { Trace } from '@/components/carte';
import type { BandeEau } from '@/lib/inondation';

import { COULEUR_BANDE_EAU, EPAISSEUR_BANDE_EAU } from './style';

/** Bande bleue semi-transparente sur la rue touchée par de l'eau accumulée (jamais un disque autour du repère). */
export function BandesInondation({ bandes }: { bandes: BandeEau[] }) {
  return (
    <>
      {bandes.map((b) => (
        <Trace key={b.id} id={b.id} points={b.points} couleur={COULEUR_BANDE_EAU} epaisseur={EPAISSEUR_BANDE_EAU} />
      ))}
    </>
  );
}
