import { useCallback, useSyncExternalStore } from 'react';

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
  deconnecter: () => Promise<void>;
} {
  const citoyen = useSyncExternalStore(abonnerEmploye, citoyenCourant, citoyenCourant);
  const session = useSessionEmploye();
  const { equipeId } = useMonEquipe();
  const ecran: EcranRole | null = session.employe ? (session.peutGerer ? 'superviseur' : 'employe') : citoyen ? 'citoyen' : null;
  const nom = session.employe?.nom ?? citoyen?.nom ?? null;
  const { deconnecter: deconnecterEmploye } = session;
  const deconnecter = useCallback(async () => {
    definirCitoyen(null);
    await deconnecterEmploye();
  }, [deconnecterEmploye]);
  return { ecran, nom, citoyen, equipeId, demoHorsLigne: session.demoHorsLigne, deconnecter };
}
