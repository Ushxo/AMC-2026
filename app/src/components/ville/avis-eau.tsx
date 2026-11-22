import { Cercle, Zone } from '@/components/carte';
import { RAYON_AVIS_POINT_M } from '@/lib/config';
import type { AvisEau as AvisEauType } from '@/types';

import { AVIS_EAU } from './style';

/** Zones d'avis d'eau (bleu pétrole) : cercle autour d'un point, ou polygone de l'avis. */
export function AvisEau({ avis }: { avis: AvisEauType[] }) {
  return (
    <>
      {avis.flatMap((f) => {
        const g = f.geometry;
        if (!g) return [];
        if (g.type === 'Point') {
          return [
            <Cercle
              key={`a-${f.properties.id}`}
              id={`avis-${f.properties.id}`}
              centre={{ latitude: g.coordinates[1], longitude: g.coordinates[0] }}
              rayonM={RAYON_AVIS_POINT_M}
              contour={AVIS_EAU.contour}
              fond={AVIS_EAU.fond}
              epaisseur={AVIS_EAU.epaisseur}
            />,
          ];
        }
        const anneaux = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        return anneaux.map((poly, i) => (
          <Zone
            key={`a-${f.properties.id}-${i}`}
            id={`avis-${f.properties.id}-${i}`}
            exterieur={poly[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            contour={AVIS_EAU.contour}
            fond={AVIS_EAU.fond}
            epaisseur={AVIS_EAU.epaisseur}
          />
        ));
      })}
    </>
  );
}
