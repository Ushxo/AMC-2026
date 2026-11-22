import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { abonnerDemandes, chargerPrecalcule, lireDerniereTerminee } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import { nettoyerResultat } from '../lib/tournees';
import { abonnerTournees, lireDernierPlan, lireEtatTournees, memoriserDernierPlan } from '../lib/store-tournees';
import type { ResultatOptimisation, SourceTournees } from '../types';
import { useSource } from './use-source';

const INTERROGATION_MS = 5000;

// Une seule lecture à la fois, partagée par tous les écrans, et le dernier plan valide est gardé : un plan ne disparaît
// jamais parce qu'une lecture échoue, tarde ou rend null (par exemple pendant un guidage).
let lectureEnCours: Promise<ResultatOptimisation | null> | null = null;

function lireUneFois(): Promise<ResultatOptimisation | null> {
  if (!lectureEnCours) {
    lectureEnCours = lireDerniereTerminee()
      .catch(() => null)
      .finally(() => {
        lectureEnCours = null;
      });
  }
  return lectureEnCours;
}

/** Accepte une lecture si elle est valide et pas plus ancienne que le plan gardé. Rend le plan à afficher. */
export function retenirPlan(
  precedent: ResultatOptimisation | null,
  lu: ResultatOptimisation | null,
): ResultatOptimisation | null {
  if (!lu || !Array.isArray(lu.tournees)) return precedent;
  if (precedent && lu.calcule_le && precedent.calcule_le && lu.calcule_le < precedent.calcule_le) return precedent;
  return lu;
}


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
  const [direct, setDirect] = useState<ResultatOptimisation | null>(lireDernierPlan);
  const [chargement, setChargement] = useState(() => lireDernierPlan() === null);
  const actif = useRef(true);

  const rafraichir = useCallback(async () => {
    if (etatSource() === 'repli') {
      if (actif.current) setChargement(false);
      return;
    }
    const lu = await lireUneFois();
    const plan = retenirPlan(lireDernierPlan(), lu);
    memoriserDernierPlan(plan);
    if (!actif.current) return;
    setDirect(plan);
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

  // Pendant un nouveau calcul, sans plan en place : on montre tout de suite le plan précalculé (l'écran dit qu'un calcul est en cours).
  const attenteDuCalcul = store.calculEnCours && !direct;
  if (etat === 'repli' || store.forcerPrecalcule || attenteDuCalcul) {
    const precalcule = chargerPrecalcule(store.incidentDemo);
    return { resultat: nettoyerResultat(precalcule), source: 'precalcule', chargement: false, erreur: null, rafraichir };
  }
  return { resultat: nettoyerResultat(direct), source: 'direct', chargement, erreur: null, rafraichir };
}
