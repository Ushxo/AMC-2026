import { useCallback, useMemo, useState } from 'react';

import { chargerPrecalcule } from '../lib/optimisation';
import { nettoyerResultat } from '../lib/tournees';
import { reordonnerRestants } from '../lib/reordre';
import { MESSAGE_ARRET_ECHEC, MESSAGE_ARRET_FAIT_PARTIEL } from '../lib/messages';
import {
  erreurCommentaire,
  MESSAGE_COMMENTAIRE_SANS_BASE,
  MESSAGE_NON_FAIT,
  MESSAGE_NON_FAIT_LOCAL,
  MESSAGE_RESULTAT_MIGRATION,
} from '../lib/messages-resultat';
import {
  arretsTries,
  commentaireArret,
  ecrireArretFait,
  ecrireResultatArret,
  idArret,
  noterFaitLocal,
  noterNonFaitLocal,
  noterPartiel,
  statutArret,
  type StatutArret,
  tourneeTerminee,
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
  /** Passé sans faire l'arrêt : compte comme traité, ses signalements restent ouverts. */
  estNonFait: (a: Arret) => boolean;
  /** Fait ou non fait : l'équipe a donné son résultat. */
  estTraite: (a: Arret) => boolean;
  statut: (a: Arret) => StatutArret;
  commentaire: (a: Arret) => string | null;
  traites: number;
  nonFaits: number;
  /** Oui ou Non sur un arrêt, avec un commentaire (obligatoire pour Non). Rend un message d'erreur, ou null (message de succès dans `info`). */
  enregistrerResultat: (arretId: string, p: { fait: boolean; commentaire: string }) => Promise<{ erreur: string | null; info: string | null }>;
  estPartiel: (a: Arret) => boolean;
  aller: (delta: number) => void;
  /** Réordonne localement les arrêts restants depuis cette position (estimation à vol d'oiseau). */
  reordonnerDepuis: (position: Coordonnees) => void;
  /** Vrai si l'ordre des arrêts restants a été réordonné sur ce téléphone. */
  ordreLocal: boolean;
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
  const locaux = useEtatTrajet();
  const { partiels } = locaux;
  const [choix, setChoix] = useState<string | null>(null);
  const [ordreCles, setOrdreCles] = useState<string[] | null>(null);

  const tournee = useMemo(() => trouverTournee(resultat, equipeId), [resultat, equipeId]);
  const statut = useCallback((a: Arret) => statutArret(a, locaux), [locaux]);
  const estFait = useCallback((a: Arret) => statut(a) === 'fait', [statut]);
  const estNonFait = useCallback((a: Arret) => statut(a) === 'non_fait', [statut]);
  const estTraite = useCallback((a: Arret) => statut(a) !== null, [statut]);
  const commentaire = useCallback((a: Arret) => commentaireArret(a, locaux), [locaux]);
  const arrets = useMemo(() => {
    if (!tournee) return [];
    const tries = arretsTries(tournee);
    if (!ordreCles) return tries;
    // Ordre local : les arrêts faits d'abord, puis les restants dans l'ordre estimé, numérotés de nouveau.
    const faitsEnPremier = tries.filter(estTraite);
    const parCle = new Map(tries.filter((a) => !estTraite(a)).map((a) => [idArret(a), a]));
    const restants = ordreCles.map((c) => parCle.get(c)).filter((a): a is Arret => !!a);
    const oublies = [...parCle.values()].filter((a) => !ordreCles.includes(idArret(a)));
    return [...faitsEnPremier, ...restants, ...oublies].map((a, i) => ({ ...a, rang: i + 1 }));
  }, [tournee, ordreCles, estTraite]);
  const estPartiel = useCallback((a: Arret) => partiels.has(idArret(a)), [partiels]);

  const prochain = useMemo(() => arrets.find((a) => !estTraite(a)) ?? null, [arrets, estTraite]);
  const courant = useMemo(
    () => (choix ? (arrets.find((a) => idArret(a) === choix) ?? prochain) : prochain),
    [arrets, choix, prochain],
  );
  const faits = arrets.filter(estFait).length;
  const nonFaits = arrets.filter(estNonFait).length;
  const traites = faits + nonFaits;
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

  const reordonnerDepuis = useCallback(
    (pos: Coordonnees) => {
      const restants = arrets.filter((a) => !estTraite(a));
      setOrdreCles(reordonnerRestants(pos, restants).map(idArret));
      setChoix(null);
    },
    [arrets, estTraite],
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

  const enregistrerResultat = useCallback(
    async (id: string, p: { fait: boolean; commentaire: string }): Promise<{ erreur: string | null; info: string | null }> => {
      const a = arrets.find((x) => idArret(x) === id);
      if (!a) return { erreur: MESSAGE_ARRET_ECHEC, info: null };
      const invalide = erreurCommentaire(p.fait, p.commentaire);
      if (invalide) return { erreur: invalide, info: null };
      const mot = p.commentaire.trim() || null;
      const avant = statut(a);
      let info: string | null = null;
      if (!local && a.id) {
        const r = await ecrireResultatArret(a.id, { fait: p.fait, commentaire: mot });
        if (r === 'migration') return { erreur: MESSAGE_RESULTAT_MIGRATION, info: null };
        if (r === 'echec') return { erreur: MESSAGE_ARRET_ECHEC, info: null };
        if (r === 'ok_sans_commentaire' && mot) info = MESSAGE_COMMENTAIRE_SANS_BASE;
      }
      const ouverts = (ids: string[], etats: string[]) =>
        ids.filter((sid) => {
          const s = signalements.find((x) => x.id === sid);
          return s ? etats.includes(s.etat) : false;
        });
      if (p.fait) {
        noterFaitLocal(id, mot);
        const reponses = await Promise.all(ouverts(a.signalement_ids, ['nouveau', 'pris_en_charge']).map((sid) => changer(sid, 'regle')));
        const echec = reponses.some((r) => r !== null);
        noterPartiel(id, echec);
        setChoix(null);
        if (!local) void rafraichir();
        return { erreur: null, info: echec ? MESSAGE_ARRET_FAIT_PARTIEL : info };
      }
      // Non : les signalements de l'endroit restent ouverts. Un arrêt d'abord noté fait les rouvre (correction du choix).
      noterNonFaitLocal(id, mot);
      noterPartiel(id, false);
      if (avant === 'fait') {
        await Promise.all(ouverts(a.signalement_ids, ['regle']).map((sid) => changer(sid, 'pris_en_charge')));
      }
      setChoix(null);
      if (!local) void rafraichir();
      return { erreur: null, info: local ? MESSAGE_NON_FAIT_LOCAL : MESSAGE_NON_FAIT };
    },
    [arrets, local, statut, signalements, changer, rafraichir],
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
    estNonFait,
    estTraite,
    statut,
    commentaire,
    traites,
    nonFaits,
    enregistrerResultat,
    estPartiel,
    aller,
    reordonnerDepuis,
    ordreLocal: ordreCles !== null,
    marquerFait,
    // La fin ne regarde que les arrêts de la tournée affichée : l'échec d'une autre tournée ne la retient pas.
    terminee: tourneeTerminee(arrets, estTraite, estPartiel),
    chargement,
  };
}
