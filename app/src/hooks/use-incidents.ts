import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { ajouterIncident, lireIncidents, retirerIncident } from '../lib/equipes';
import { chargerPrecalcule } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import { abonnerTournees, lireEtatTournees, modifierEtatTournees } from '../lib/store-tournees';
import type { Incident, NouvelIncident } from '../types';
import { useSource } from './use-source';

export function useIncidents(): {
  incidents: Incident[];
  ajouter: (n: NouvelIncident) => Promise<string | null>;
  retirer: (id: string) => Promise<string | null>;
  chargement: boolean;
  erreur: string | null;
} {
  const { etat } = useSource();
  const store = useSyncExternalStore(abonnerTournees, lireEtatTournees, lireEtatTournees);
  const [lus, setLus] = useState<Incident[]>([]);
  const [chargement, setChargement] = useState(true);
  const actif = useRef(true);

  const charger = useCallback(async () => {
    if (etatSource() === 'repli') {
      if (actif.current) setChargement(false);
      return;
    }
    const l = await lireIncidents();
    if (!actif.current) return;
    if (l) setLus(l.filter((i) => !!i && !!i.id));
    setChargement(false);
  }, []);

  useEffect(() => {
    actif.current = true;
    const t = setTimeout(() => void charger(), 0);
    return () => {
      actif.current = false;
      clearTimeout(t);
    };
  }, [charger, etat]);

  const ajouter = useCallback(
    async (n: NouvelIncident) => {
      if (etatSource() === 'repli') {
        // Hors ligne : seul l'incident de démo prévu existe ; il bascule l'affichage sur son résultat.
        modifierEtatTournees({ incidentDemo: true });
        return null;
      }
      const r = await ajouterIncident(n);
      if (!r) await charger();
      return r;
    },
    [charger],
  );

  const retirer = useCallback(
    async (id: string) => {
      if (etatSource() === 'repli') {
        modifierEtatTournees({ incidentDemo: false });
        return null;
      }
      const r = await retirerIncident(id);
      if (!r) await charger();
      return r;
    },
    [charger],
  );

  let incidents = lus;
  if (etat === 'repli') {
    const demo = (store.incidentDemo ? (chargerPrecalcule(true)?.incidents ?? []) : []).filter((i) => !!i && !!i.id);
    incidents = demo.map((i) => ({
      ...i,
      description: null,
      actif: true,
      simule: true as const,
      cree_le: '',
    }));
  }
  return { incidents, ajouter, retirer, chargement, erreur: null };
}
