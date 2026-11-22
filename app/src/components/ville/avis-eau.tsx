import { Cercle, Zone } from '@/components/carte';
import { RAYON_AVIS_POINT_M } from '@/lib/config';
import type { AvisEau as AvisEauType } from '@/types';

import { STYLE_AVIS } from './style';

/** Avis d'eau : ébullition (bleu pétrole) et coupures (indigo), cercle autour d'un point ou polygone de l'avis. Le toucher ouvre la fiche. */
export function AvisEau({ avis, onChoisir }: { avis: AvisEauType[]; onChoisir?: (a: AvisEauType) => void }) {
  return (
    <>
      {avis.flatMap((f) => {
        const g = f.geometry;
        if (!g) return [];
        const st = STYLE_AVIS[f.properties.type];
        if (g.type === 'Point') {
          return [
            <Cercle
              key={`a-${f.properties.id}`}
              id={`avis-${f.properties.id}`}
              centre={{ latitude: g.coordinates[1], longitude: g.coordinates[0] }}
              rayonM={RAYON_AVIS_POINT_M}
              contour={st.contour}
              fond={st.fond}
              epaisseur={st.epaisseur}
            />,
          ];
        }
        const anneaux = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        return anneaux.map((poly, i) => (
          <Zone
            key={`a-${f.properties.id}-${i}`}
            id={`avis-${f.properties.id}-${i}`}
            exterieur={poly[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            contour={st.contour}
            fond={st.fond}
            epaisseur={st.epaisseur}
            onPress={() => onChoisir?.(f)}
          />
        ));
      })}
    </>
  );
}
