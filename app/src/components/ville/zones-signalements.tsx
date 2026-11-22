import { Zone as ZoneCarte } from '@/components/carte';
import type { Zone } from '@/lib/zones';
import { LIBELLES_GRAVITE } from '@/types';

import { STYLE_ZONE, styleZoneSelection } from './style';

type Props = {
  zones: Zone[];
  onChoisir: (z: Zone) => void;
  /** Mode sélection : état de chaque zone, montré par l'aspect (contour et remplissage). */
  etatDe?: (z: Zone) => 'toutes' | 'certaines' | 'aucune';
};

/** Libellé d'accessibilité d'une zone : « Zone de signalements, gravité élevée, 4 signalements ». */
export function libelleZone(z: Zone): string {
  const n = z.signalement_ids.length;
  return `Zone de signalements, gravité ${LIBELLES_GRAVITE[z.gravite].toLowerCase()}, ${n} signalement${n > 1 ? 's' : ''}`;
}

/** Zones translucides sous les repères. Le toucher marche aussi par la carte (voir `zoneEn`). */
export function ZonesSignalements({ zones, onChoisir, etatDe }: Props) {
  return (
    <>
      {zones.flatMap((z) =>
        z.polygones.map((p, i) => {
          const st = etatDe ? styleZoneSelection(z.gravite, etatDe(z)) : STYLE_ZONE[z.gravite];
          return (
          <ZoneCarte
            key={`${z.id}-${i}`}
            id={`${z.id}-${i}`}
            exterieur={p.exterieur}
            trous={p.trous}
            fond={st.fond}
            contour={st.contour}
            epaisseur={st.epaisseur}
            onPress={() => onChoisir(z)}
          />
          );
        }),
      )}
    </>
  );
}
