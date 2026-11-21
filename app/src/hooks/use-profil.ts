import { useEffect, useState } from 'react';

import { monProfil, surChangementDeSession, type Profil } from '@/lib/auth';

/**
 * Profil de l'utilisateur connecté, tenu à jour à chaque login/logout.
 *
 *   const { profil, chargement } = useProfil();
 *   if (chargement) return <Splash />;
 *   if (!profil) return <Redirect href="/login" />;
 */
export function useProfil(): { profil: Profil | null; chargement: boolean } {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    monProfil()
      .catch(() => null)
      .then((p) => {
        if (!actif) return;
        setProfil(p);
        setChargement(false);
      });
    const desabonner = surChangementDeSession((p) => {
      if (actif) setProfil(p);
    });
    return () => {
      actif = false;
      desabonner();
    };
  }, []);

  return { profil, chargement };
}
