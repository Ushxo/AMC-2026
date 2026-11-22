import { useCallback, useState } from 'react';

import { RAYON_GRILLE_M } from '../lib/config';
import { grillePlusProche } from '../lib/geo';
import { ajouterMonId } from '../lib/mes-signalements';
import { creerSignalement } from '../lib/source';
import { validerSignalement } from '../lib/validation';
import type { NouveauSignalement, ResultatEnvoi } from '../types';
import { useCouches } from './use-couches';

export function useCreerSignalement(): {
  envoyer: (n: NouveauSignalement) => Promise<ResultatEnvoi>;
  envoiEnCours: boolean;
} {
  const { couches } = useCouches();
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const envoyer = useCallback(
    async (n: NouveauSignalement): Promise<ResultatEnvoi> => {
      const erreurs = validerSignalement(n);
      if (erreurs.length > 0) return { statut: 'invalide', erreurs };
      setEnvoiEnCours(true);
      try {
        const grille = grillePlusProche(n, couches.grilles, RAYON_GRILLE_M);
        const r = await creerSignalement({ ...n, grille_id: grille?.properties.id ?? null });
        if ((r.statut === 'envoye' || r.statut === 'en_attente') && r.signalement?.id) await ajouterMonId(r.signalement.id);
        return r;
      } finally {
        setEnvoiEnCours(false);
      }
    },
    [couches.grilles],
  );
  return { envoyer, envoiEnCours };
}
