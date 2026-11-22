import { Cercle, Trace, Zone } from '@/components/carte';
import { tracesAvis } from '@/lib/avis-troncons';
import { RAYON_AVIS_POINT_M } from '@/lib/config';
import type { AvisEau as AvisEauType } from '@/types';

import { STYLE_AVIS } from './style';

/**
 * Avis d'eau officiels : ébullition (bleu pétrole) et coupures (indigo). Un avis en ligne (ou en point) suit les rues réelles qu'il touche,
 * en trait épais avec un liseré sombre ; un secteur officiel est dessiné tel quel, sans l'arrondir ; sans tracé de rue, la forme officielle.
 * Le toucher se fait sur la carte (voir elementTouche), pas sur le dessin.
 */
export function AvisEau({ avis }: { avis: AvisEauType[] }) {
  return (
    <>
      {avis.flatMap((f) => {
        const st = STYLE_AVIS[f.properties.type];
        const traces = tracesAvis(f);
        if (traces) {
          return traces.flatMap((points, i) => [
            <Trace key={`a-${f.properties.id}-${i}-l`} id={`avis-${f.properties.id}-${i}-l`} points={points} couleur={st.liseré} epaisseur={st.largeur + 5} />,
            <Trace key={`a-${f.properties.id}-${i}`} id={`avis-${f.properties.id}-${i}`} points={points} couleur={st.couleur} epaisseur={st.largeur} />,
          ]);
        }
        const g = f.geometry;
        if (!g) return [];
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
          />
        ));
      })}
    </>
  );
}
