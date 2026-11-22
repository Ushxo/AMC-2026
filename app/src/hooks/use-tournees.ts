import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { abonnerDemandes, chargerPrecalcule, lireDerniereTerminee } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import { nettoyerResultat } from '../lib/tournees';
import { abonnerTournees, lireEtatTournees } from '../lib/store-tournees';
import type { ResultatOptimisation, SourceTournees } from '../types';
import { useSource } from './use-source';

const INTERROGATION_MS = 5000;

/** Dernière optimisation terminée (Realtime, puis interrogation). Précalculé hors ligne ou après un délai. */
export function useTournees(): {
  resultat: ResultatOptimisation | null;
  source: SourceTournees;
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
} {
  const store = useSyncExternalStore(abonnerTournees, lireEtatTournees, lireEtatTournees);
  const { etat } = useSource();
  const [direct, setDirect] = useState<ResultatOptimisation | null>(null);
  const [chargement, setChargement] = useState(true);
  const actif = useRef(true);

  const rafraichir = useCallback(async () => {
    if (etatSource() === 'repli') {
      if (actif.current) setChargement(false);
      return;
    }
    const r = await lireDerniereTerminee();
    if (!actif.current) return;
    setDirect(r);
    setChargement(false);
  }, []);

  useEffect(() => {
    actif.current = true;
    const depart = setTimeout(() => void rafraichir(), 0);
    const arret = abonnerDemandes(() => void rafraichir());
    const minuteur = setInterval(() => void rafraichir(), INTERROGATION_MS);
    return () => {
      actif.current = false;
      clearTimeout(depart);
      clearInterval(minuteur);
      arret();
    };
  }, [rafraichir]);

  // Un nouveau résultat ou un changement d'état de la source : on relit.
  useEffect(() => {
    const t = setTimeout(() => void rafraichir(), 0);
    return () => clearTimeout(t);
  }, [store.version, etat, rafraichir]);

  if (etat === 'repli' || store.forcerPrecalcule) {
    const precalcule = chargerPrecalcule(store.incidentDemo);
    return { resultat: nettoyerResultat(precalcule), source: 'precalcule', chargement: false, erreur: null, rafraichir };
  }
  return { resultat: nettoyerResultat(direct), source: 'direct', chargement, erreur: null, rafraichir };
}
