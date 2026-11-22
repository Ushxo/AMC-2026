import { useCallback, useMemo, useState } from 'react';

import { chargerPrecalcule } from '../lib/optimisation';
import { nettoyerResultat } from '../lib/tournees';
import { MESSAGE_ARRET_ECHEC, MESSAGE_ARRET_FAIT_PARTIEL } from '../lib/messages';
import {
  arretsTries,
  ecrireArretFait,
  idArret,
  noterFaitLocal,
  noterPartiel,
  prochainArret,
  trouverTournee,
  useEtatTrajet,
} from '../lib/trajet';
import type { Arret, Coordonnees, Tournee } from '../types';
import { useChangerEtat } from './use-changer-etat';
import { usePosition } from './use-position';
import { useSessionEmploye } from './use-session-employe';
import { useSignalements } from './use-signalements';
import { useTournees } from './use-tournees';

/**
 * Suivi d'une tournée par l'employé : arrêts faits, prochain arrêt, position de l'appareil.
 * Ce n'est PAS un guidage : on suit des arrêts, pas des virages.
 * « Arrêt fait » écrit l'arrêt (fait, fait_le) puis passe à « réglé » ses signalements encore ouverts.
 */
export function useSuiviTrajet(equipeId: string): {
  tournee: Tournee | null;
  arrets: Arret[];
  prochain: Arret | null;
  courant: Arret | null;
  faits: number;
  total: number;
  position: Coordonnees | null;
  local: boolean;
  estFait: (a: Arret) => boolean;
  estPartiel: (a: Arret) => boolean;
  aller: (delta: number) => void;
  marquerFait: (arretId: string) => Promise<string | null>;
  terminee: boolean;
  chargement: boolean;
} {
  const { resultat: lu, chargement, rafraichir } = useTournees();
  const { demoHorsLigne } = useSessionEmploye();
  // Compte de démonstration : la base ne lui donne aucune tournée, on suit le résultat précalculé.
  const resultat = useMemo(
    () => lu ?? (demoHorsLigne ? nettoyerResultat(chargerPrecalcule(false)) : null),
    [lu, demoHorsLigne],
  );
  const { position } = usePosition();
  const { signalements } = useSignalements();
  const { changer } = useChangerEtat();
  const { faits: faitsLocaux, partiels } = useEtatTrajet();
  const [choix, setChoix] = useState<string | null>(null);

  const tournee = useMemo(() => trouverTournee(resultat, equipeId), [resultat, equipeId]);
  const arrets = useMemo(() => (tournee ? arretsTries(tournee) : []), [tournee]);
  const estFait = useCallback((a: Arret) => Boolean(a.fait) || faitsLocaux.has(idArret(a)), [faitsLocaux]);
  const estPartiel = useCallback((a: Arret) => partiels.has(idArret(a)), [partiels]);

  const prochain = useMemo(() => (tournee ? prochainArret(tournee, estFait) : null), [tournee, estFait]);
  const courant = useMemo(
    () => (choix ? (arrets.find((a) => idArret(a) === choix) ?? prochain) : prochain),
    [arrets, choix, prochain],
  );
  const faits = arrets.filter(estFait).length;
  const local = demoHorsLigne || arrets.some((a) => !a.id);

  const aller = useCallback(
    (delta: number) => {
      if (arrets.length === 0) return;
      const index = courant ? arrets.findIndex((a) => idArret(a) === idArret(courant)) : 0;
      const suivant = arrets[Math.min(arrets.length - 1, Math.max(0, index + delta))];
      setChoix(idArret(suivant));
    },
    [arrets, courant],
  );

  const marquerFait = useCallback(
    async (id: string): Promise<string | null> => {
      const a = arrets.find((x) => idArret(x) === id);
      if (!a) return MESSAGE_ARRET_ECHEC;
      const dejaFait = estFait(a);
      if (dejaFait && !partiels.has(id)) return null;
      if (!dejaFait) {
        if (!local && a.id) {
          if (!(await ecrireArretFait(a.id))) return MESSAGE_ARRET_ECHEC;
        }
        noterFaitLocal(id);
      }
      // Les signalements encore ouverts de cet arrêt passent à « réglé » (historisé par la base).
      const ouverts = a.signalement_ids.filter((sid) => {
        const s = signalements.find((x) => x.id === sid);
        return s ? s.etat === 'nouveau' || s.etat === 'pris_en_charge' : false;
      });
      const reponses = await Promise.all(ouverts.map((sid) => changer(sid, 'regle')));
      const echec = reponses.some((r) => r !== null);
      noterPartiel(id, echec);
      setChoix(null);
      if (!local) void rafraichir();
      return echec ? MESSAGE_ARRET_FAIT_PARTIEL : null;
    },
    [arrets, estFait, partiels, local, signalements, changer, rafraichir],
  );

  return {
    tournee,
    arrets,
    prochain,
    courant,
    faits,
    total: arrets.length,
    position,
    local,
    estFait,
    estPartiel,
    aller,
    marquerFait,
    terminee: arrets.length > 0 && faits === arrets.length && partiels.size === 0,
    chargement,
  };
}
