import { useEffect, useRef, useState } from 'react';

import { distanceAuTrace, doitRecalculer } from '../lib/navigation';
import { lireTronconOsrm, tronconDroit, type Troncon } from '../lib/troncon';
import type { Coordonnees } from '../types';

/**
 * Tronçon de la position actuelle au prochain arrêt : ligne droite tout de suite, puis route OSRM.
 * Une requête au nouvel arrêt ou si l'équipe s'écarte de plus de 100 m du tracé, jamais plus d'une toutes les 10 s.
 */
export function useTroncon(depart: Coordonnees | null, arrivee: Coordonnees | null, cleArrivee: string | null): Troncon | null {
  const [troncon, setTroncon] = useState<Troncon | null>(null);
  const dernier = useRef<{ envoiMs: number | null; cle: string | null }>({ envoiMs: null, cle: null });
  const courant = useRef<Troncon | null>(null);
  const cleCourante = useRef<string | null>(cleArrivee);
  const monte = useRef(true);

  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const departLat = depart?.latitude ?? null;
  const departLng = depart?.longitude ?? null;
  const arriveeLat = arrivee?.latitude ?? null;
  const arriveeLng = arrivee?.longitude ?? null;

  useEffect(() => {
    if (departLat === null || departLng === null || arriveeLat === null || arriveeLng === null) {
      courant.current = null;
      const t = setTimeout(() => setTroncon(null), 0);
      return () => clearTimeout(t);
    }
    const a = { latitude: departLat, longitude: departLng };
    const b = { latitude: arriveeLat, longitude: arriveeLng };
    const arriveeChangee = dernier.current.cle !== cleArrivee;
    const ecartM = courant.current && !courant.current.droite ? distanceAuTrace(a, courant.current.points) : Infinity;
    const maintenantMs = Date.now();
    cleCourante.current = cleArrivee;
    const t = setTimeout(() => {
      // Entre deux requêtes, le trait part de la position actuelle (ligne droite) si on n'a pas de route.
      if (arriveeChangee || !courant.current || courant.current.droite) {
        const droit = tronconDroit(a, b);
        courant.current = droit;
        setTroncon(droit);
      }
      if (!doitRecalculer({ dernierEnvoiMs: dernier.current.envoiMs, maintenantMs, arriveeChangee, ecartM })) return;
      dernier.current = { envoiMs: maintenantMs, cle: cleArrivee };
      void lireTronconOsrm(a, b).then((r) => {
        // Réponse tardive pour un autre arrêt : ignorée. Sinon elle compte même si la position a bougé entre-temps.
        if (!monte.current || cleCourante.current !== cleArrivee) return;
        const suivant = r ?? tronconDroit(a, b);
        courant.current = suivant;
        setTroncon(suivant);
      });
    }, 0);
    return () => clearTimeout(t);
  }, [departLat, departLng, arriveeLat, arriveeLng, cleArrivee]);

  return troncon;
}
