import { useEffect, useState, useSyncExternalStore } from 'react';

import { lireMonEquipe } from '../lib/equipe-compte';
import { abonnerEmploye, employeCourant, estEmployeDemo } from '../lib/session';
import { etatSource } from '../lib/source';

/** Équipe liée au compte connecté (mon_equipe). Rien en démonstration, hors ligne ou si la base n'a pas la fonction. */
export function useMonEquipe(): { equipeId: string | null; disponible: boolean; chargement: boolean } {
  const employe = useSyncExternalStore(abonnerEmploye, employeCourant, employeCourant);
  const [etat, setEtat] = useState<{ equipeId: string | null; disponible: boolean; chargement: boolean }>({
    equipeId: null,
    disponible: false,
    chargement: true,
  });
  const reel = !!employe && !estEmployeDemo(employe);
  const identifiant = employe?.user_id ?? null;

  useEffect(() => {
    let actif = true;
    const t = setTimeout(async () => {
      if (!reel || etatSource() === 'repli') {
        if (actif) setEtat({ equipeId: null, disponible: false, chargement: false });
        return;
      }
      const r = await lireMonEquipe();
      if (actif) setEtat({ ...r, chargement: false });
    }, 0);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [reel, identifiant]);

  return etat;
}
