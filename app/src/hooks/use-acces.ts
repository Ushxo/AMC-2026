import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { restaurerSession } from '../lib/auth';
import type { EcranRole } from '../lib/connexion';
import { abonnerEmploye, citoyenCourant, definirCitoyen, type CitoyenConnecte } from '../lib/session';
import { useMonEquipe } from './use-mon-equipe';
import { useSessionEmploye } from './use-session-employe';

/**
 * Qui est connecté, pour choisir la coquille : citoyen, superviseur (ou admin), employé d'équipe, ou personne.
 * Réunit la session des employés (mode Ville) et celle des citoyens ; la démonstration hors ligne entre comme superviseur simulé.
 */
export function useAcces(): {
  ecran: EcranRole | null;
  nom: string | null;
  citoyen: CitoyenConnecte | null;
  equipeId: string | null;
  demoHorsLigne: boolean;
  /** Faux tant que la session gardée n'est pas reprise : l'écran de connexion ne doit pas clignoter pour quelqu'un déjà connecté. */
  pret: boolean;
  deconnecter: () => Promise<void>;
} {
  const citoyen = useSyncExternalStore(abonnerEmploye, citoyenCourant, citoyenCourant);
  const session = useSessionEmploye();
  const { equipeId } = useMonEquipe();
  const [pret, setPret] = useState(false);
  useEffect(() => {
    let actif = true;
    // Reprise de la session gardée ; au plus 2,5 s d'attente (réseau absent : on montre la connexion).
    const delai = setTimeout(() => actif && setPret(true), 2500);
    void restaurerSession().finally(() => {
      clearTimeout(delai);
      if (actif) setPret(true);
    });
    return () => {
      actif = false;
      clearTimeout(delai);
    };
  }, []);
  const ecran: EcranRole | null = session.employe ? (session.role === 'admin' ? 'admin' : session.peutGerer ? 'superviseur' : 'employe') : citoyen ? 'citoyen' : null;
  const nom = session.employe?.nom ?? citoyen?.nom ?? null;
  const { deconnecter: deconnecterEmploye } = session;
  const deconnecter = useCallback(async () => {
    definirCitoyen(null);
    await deconnecterEmploye();
  }, [deconnecterEmploye]);
  return { ecran, nom, citoyen, equipeId, demoHorsLigne: session.demoHorsLigne, pret, deconnecter };
}
