import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { lireAcces, restaurerSession, surveillerSession } from '../lib/auth';
import {
  MESSAGE_CONNEXION_REFUSEE,
  MESSAGE_CONNEXION_RESEAU,
  MESSAGE_PANNE_EMPLOYES,
  MESSAGE_PAS_EMPLOYE,
} from '../lib/messages';
import {
  abonnerEmploye,
  avertissementSession,
  definirAvertissement,
  definirEmploye,
  employeCourant,
  estEmployeDemo,
  peutGerer,
  roleCourant,
  type RoleVille,
  ID_EMPLOYE_DEMO,
} from '../lib/session';
import { etatSource } from '../lib/source';
import { getSupabase } from '../lib/supabase';
import type { Employe } from '../types';

let restauree = false;

export function useSessionEmploye(): {
  employe: Employe | null;
  demoHorsLigne: boolean;
  connecter: (courriel: string, motDePasse: string) => Promise<string | null>;
  entrerDemoHorsLigne: () => void;
  deconnecter: () => Promise<void>;
  avertissement: string | null;
  role: RoleVille | null;
  peutGerer: boolean;
} {
  const employe = useSyncExternalStore(abonnerEmploye, employeCourant, employeCourant);
  const role = useSyncExternalStore(abonnerEmploye, roleCourant, roleCourant);
  const avertissement = useSyncExternalStore(abonnerEmploye, avertissementSession, avertissementSession);

  useEffect(() => {
    if (!restauree) {
      restauree = true;
      void restaurerSession();
    }
    return surveillerSession();
  }, []);

  const connecter = useCallback(async (courriel: string, motDePasse: string) => {
    const client = getSupabase();
    if (!client) return MESSAGE_CONNEXION_RESEAU;
    definirAvertissement(null);
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: courriel.trim(),
        password: motDePasse,
      });
      if (error) {
        return error.name === 'AuthRetryableFetchError' ? MESSAGE_CONNEXION_RESEAU : MESSAGE_CONNEXION_REFUSEE;
      }
      let e: Awaited<ReturnType<typeof lireAcces>>;
      try {
        e = await lireAcces(data.user.id, data.user.email ?? courriel.trim());
      } catch {
        return MESSAGE_PANNE_EMPLOYES; // panne de lecture : pas de déconnexion
      }
      if (!e) {
        await client.auth.signOut();
        return MESSAGE_PAS_EMPLOYE;
      }
      definirEmploye(e.employe, e.role);
      return null;
    } catch {
      return MESSAGE_CONNEXION_RESEAU;
    }
  }, []);

  const deconnecter = useCallback(async () => {
    definirEmploye(null);
    try {
      await getSupabase()?.auth.signOut();
    } catch {
      // La session locale est déjà fermée.
    }
  }, []);

  const entrerDemoHorsLigne = useCallback(() => {
    if (etatSource() !== 'repli') return;
    definirEmploye({
      user_id: ID_EMPLOYE_DEMO,
      nom: 'Employé de démonstration',
      courriel: 'démonstration hors ligne',
    });
  }, []);

  return {
    employe,
    demoHorsLigne: estEmployeDemo(employe),
    connecter,
    entrerDemoHorsLigne,
    deconnecter,
    avertissement,
    role,
    peutGerer: peutGerer(role),
  };
}
