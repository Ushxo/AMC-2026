import { useCallback, useEffect, useMemo, useState } from 'react';

import { abonnerMesIds, lireMesIds, mesIdsNonGardes } from '../lib/mes-signalements';
import type { Signalement } from '../types';
import { useSignalements } from './use-signalements';

/** Les signalements créés depuis ce téléphone, le plus récent en premier, avec leur état à jour. */
export function useMesSignalements(): {
  mes: Signalement[];
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
  /** Vrai quand le téléphone n'a pas pu garder la liste : elle disparaît à la fermeture de l'app. */
  nonGardes: boolean;
} {
  const { signalements, chargement, erreur, rafraichir } = useSignalements();
  const [ids, setIds] = useState<string[] | null>(null);
  const [nonGardes, setNonGardes] = useState(false);

  const lire = useCallback(async () => {
    setIds(await lireMesIds());
    setNonGardes(mesIdsNonGardes());
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void lire(), 0);
    const arret = abonnerMesIds(() => void lire());
    return () => {
      clearTimeout(t);
      arret();
    };
  }, [lire]);

  const mes = useMemo(() => {
    if (!ids) return [];
    const parId = new Map(signalements.map((s) => [s.id, s]));
    return ids.map((id) => parId.get(id)).filter((s): s is Signalement => !!s);
  }, [ids, signalements]);

  return { mes, chargement: chargement || ids === null, erreur, rafraichir, nonGardes };
}
