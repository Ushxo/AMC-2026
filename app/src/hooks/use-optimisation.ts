import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { lireIncidents } from '../lib/equipes';
import { MESSAGE_OPTIMISATION_ECHEC, MESSAGE_RESULTAT_ARRIVE } from '../lib/messages';
import { abonnerDemandes, creerDemande, lireDemande } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import { abonnerTournees, lireEtatTournees, modifierEtatTournees, notifierTournees } from '../lib/store-tournees';
import { getSupabase } from '../lib/supabase';
import type { DemandeOptimisation, ParametresOptimisation } from '../types';

export const DELAI_BASCULE_MS = 20000;
export const DELAI_ABANDON_MS = 180000;
const INTERROGATION_MS = 1500;

export function useOptimisation(): {
  lancer: (p?: Partial<ParametresOptimisation>) => Promise<string | null>;
  demande: DemandeOptimisation | null;
  enCours: boolean;
  basculeSurPrecalcule: boolean;
  message: string | null;
} {
  const store = useSyncExternalStore(abonnerTournees, lireEtatTournees, lireEtatTournees);
  const [demande, setDemande] = useState<DemandeOptimisation | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const arretSuivi = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      arretSuivi.current?.();
    },
    [],
  );

  const suivre = useCallback((id: string) => {
    arretSuivi.current?.();
    let fini = false;
    let bascule = false;
    const arretRealtime = abonnerDemandes(() => void verifier());
    const minuteur = setInterval(() => void verifier(), INTERROGATION_MS);
    // 20 s sans réponse : on montre le résultat précalculé et on le dit, MAIS on continue de suivre la demande.
    const delai = setTimeout(() => {
      if (fini) return;
      bascule = true;
      setEnCours(false);
      modifierEtatTournees({ forcerPrecalcule: true });
    }, DELAI_BASCULE_MS);
    const abandon = setTimeout(() => terminer(), DELAI_ABANDON_MS);

    function terminer() {
      if (fini) return;
      fini = true;
      clearInterval(minuteur);
      clearTimeout(delai);
      clearTimeout(abandon);
      arretRealtime();
      setEnCours(false);
    }

    async function verifier() {
      const d = await lireDemande(id);
      if (fini || !d) return;
      setDemande(d);
      if (d.statut === 'terminee') {
        terminer();
        modifierEtatTournees({ forcerPrecalcule: false });
        notifierTournees();
        // Le vrai résultat remplace le précalculé : on le dit si l'écran avait basculé.
        setMessage(bascule ? MESSAGE_RESULTAT_ARRIVE : null);
      } else if (d.statut === 'echec' || d.statut === 'remplacee') {
        terminer();
      }
    }

    arretSuivi.current = terminer;
  }, []);

  const lancer = useCallback(
    async (p?: Partial<ParametresOptimisation>): Promise<string | null> => {
      setMessage(null);
      // Hors ligne : pas de calcul possible, on montre le résultat précalculé.
      if (etatSource() === 'repli' || !getSupabase()) {
        modifierEtatTournees({ forcerPrecalcule: true });
        return null;
      }
      setEnCours(true);
      // Les incidents pris en compte sont enregistrés avec la demande : l'écran affiche ceux du calcul.
      const incident_ids =
        p?.incident_ids ?? ((await lireIncidents()) ?? []).filter((i) => !!i).map((i) => i.id);
      const parametres = { ...p, incident_ids };
      const r = await creerDemande(parametres);
      // Une réponse vide ou inattendue (insertion refusée, droits insuffisants) donne un message, jamais une exception.
      if (!r || typeof r !== 'object' || 'erreur' in r || typeof r.id !== 'string') {
        setEnCours(false);
        return (r && 'erreur' in r && r.erreur) || MESSAGE_OPTIMISATION_ECHEC;
      }
      modifierEtatTournees({ forcerPrecalcule: false });
      setDemande({
        id: r.id,
        cree_le: new Date().toISOString(),
        statut: 'en_attente',
        parametres: { version: 1, equipe_ids: [], affectations_forcees: [], limite_secondes: 8, ...parametres },
        message: null,
        commence_le: null,
        termine_le: null,
      });
      suivre(r.id);
      return null;
    },
    [suivre],
  );

  return { lancer, demande, enCours, basculeSurPrecalcule: store.forcerPrecalcule, message };
}
