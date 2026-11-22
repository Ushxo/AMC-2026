import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { chargerPrecalcule, lireArretPourSignalement, type Passage } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import { abonnerTournees, lireEtatTournees } from '../lib/store-tournees';
import { calculerSuivi, trouverArret } from '../lib/suivi';
import type { SuiviSignalement } from '../types';
import { useSignalements } from './use-signalements';
import { useSource } from './use-source';

/** Suivi public d'un signalement : reçu, planifié (heure estimée), pris en charge, réglé ou rejeté. */
export function usePassage(signalementId: string): {
  suivi: SuiviSignalement;
  chargement: boolean;
  erreur: string | null;
} {
  const { etat } = useSource();
  const store = useSyncExternalStore(abonnerTournees, lireEtatTournees, lireEtatTournees);
  const { signalements, chargement, erreur } = useSignalements();
  // Chaque réponse est liée au signalement demandé : une réponse tardive d'une autre fiche est ignorée.
  const [lu, setLu] = useState<{ id: string; passage: Passage | null } | null>(null);
  const idCourant = useRef(signalementId);
  const actif = useRef(true);
  const signalement = useMemo(
    () => signalements.find((s) => s.id === signalementId) ?? null,
    [signalements, signalementId],
  );
  const horsLigne = etat === 'repli' || store.forcerPrecalcule;

  useEffect(() => {
    actif.current = true;
    idCourant.current = signalementId;
    const lire = async () => {
      if (etatSource() === 'repli') return;
      const demande = signalementId;
      try {
        const passage = await lireArretPourSignalement(demande);
        if (!actif.current || idCourant.current !== demande) return; // fiche changée entre-temps
        setLu({ id: demande, passage });
      } catch {
        // Lecture en échec : on garde ce qu'on avait pour cette fiche.
      }
    };
    const t = setTimeout(() => void lire(), 0);
    const minuteur = setInterval(() => void lire(), 15000);
    return () => {
      actif.current = false;
      clearTimeout(t);
      clearInterval(minuteur);
    };
  }, [signalementId, etat, store.version]);

  // L'ancienne heure disparaît dès le changement de fiche : on ne garde que la réponse de CE signalement.
  const passageDirect = lu && lu.id === signalementId ? lu.passage : null;

  const suivi = useMemo(() => {
    if (horsLigne) {
      const pre = chargerPrecalcule(store.incidentDemo);
      return calculerSuivi(signalement, trouverArret(pre, signalementId), true, pre?.calcule_le);
    }
    return calculerSuivi(signalement, passageDirect, false);
  }, [horsLigne, signalement, signalementId, passageDirect, store.incidentDemo]);

  return { suivi, chargement, erreur };
}
