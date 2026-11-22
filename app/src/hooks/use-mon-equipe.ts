import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { lireMonEquipePartagee } from '../lib/equipe-compte';
import { abonnerEmploye, employeCourant, estEmployeDemo } from '../lib/session';
import { etatSource } from '../lib/source';

/** Équipe liée au compte connecté (mon_equipe). Rien en démonstration, hors ligne ou si la base n'a pas la fonction. */
export function useMonEquipe(): { equipeId: string | null; disponible: boolean; chargement: boolean; /** Vrai quand la lecture a ÉCHOUÉ (réseau, serveur) : à distinguer de « aucune équipe associée ». */ echec: boolean; reessayer: () => void } {
  const employe = useSyncExternalStore(abonnerEmploye, employeCourant, employeCourant);
  const [etat, setEtat] = useState<{ equipeId: string | null; disponible: boolean; chargement: boolean; echec: boolean }>({
    equipeId: null,
    disponible: false,
    chargement: true,
    echec: false,
  });
  const [essai, setEssai] = useState(0);
  const forcer = useRef(false); // vrai après « Réessayer » : la prochaine lecture ne passe pas par le cache
  const reel = !!employe && !estEmployeDemo(employe);
  const identifiant = employe?.user_id ?? null;

  useEffect(() => {
    let actif = true;
    const t = setTimeout(async () => {
      if (!reel || etatSource() === 'repli') {
        if (actif) setEtat({ equipeId: null, disponible: false, chargement: false, echec: false });
        return;
      }
      // Lecture partagée : la connexion, la coquille de l'employé et l'écran du trajet ne font qu'une requête ; « Réessayer » relit.
      const relire = forcer.current;
      forcer.current = false;
      try {
        const r = await lireMonEquipePartagee(identifiant, relire);
        if (actif) setEtat({ ...r, chargement: false, echec: r.echec });
      } catch {
        if (actif) setEtat({ equipeId: null, disponible: false, chargement: false, echec: true });
      }
    }, 0);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [reel, identifiant, essai]);

  return { ...etat, reessayer: () => { forcer.current = true; setEtat((e) => ({ ...e, chargement: true, echec: false })); setEssai((n) => n + 1); } };
}
