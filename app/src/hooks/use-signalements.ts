import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RAFRAICHISSEMENT_MS, SONDE_REPLI_MS } from '../lib/config';
import { lister, type ElementFile } from '../lib/file-attente';
import { filtrerSignalements, type FiltreSignalements } from '../lib/filtre';
import { MESSAGE_LECTURE_ECHEC } from '../lib/messages';
import {
  abonnerChangements,
  abonnerSignalementsRealtime,
  etatSource,
  lireSignalements,
  renvoyerFile,
  sonderSource,
} from '../lib/source';
import type { Signalement } from '../types';

/** Mêmes signalements (identifiants, états, gravités, positions) : la liste précédente est gardée, rien ne se recalcule. */
export function memesSignalements(a: Signalement[], b: Signalement[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.etat !== y.etat ||
      x.gravite !== y.gravite ||
      x.categorie !== y.categorie ||
      x.latitude !== y.latitude ||
      x.longitude !== y.longitude ||
      x.etat_change_le !== y.etat_change_le ||
      x.commentaire !== y.commentaire ||
      x.photo_url !== y.photo_url ||
      Boolean(x.en_attente) !== Boolean(y.en_attente) ||
      x.echec_envoi !== y.echec_envoi
    )
      return false;
  }
  return true;
}

export function useSignalements(filtre?: FiltreSignalements): {
  signalements: Signalement[];
  rafraichir: () => Promise<void>;
  chargement: boolean;
  erreur: string | null;
} {
  const [tous, setTous] = useState<Signalement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const actif = useRef(true);

  const rafraichir = useCallback(async () => {
    try {
      await renvoyerFile();
      const file: ElementFile[] = await lister().catch(() => []); // file illisible : on n'y touche pas
      const lus = await lireSignalements();
      if (!actif.current) return;
      const ids = new Set(lus.map((s) => s.id));
      const attente = file
        .filter((e) => !ids.has(e.signalement.id))
        .map((e) => ({
          ...e.signalement,
          en_attente: true as const,
          ...(e.echec ? { echec_envoi: e.echec } : {}),
        }));
      const suivants = [...attente, ...lus];
      setTous((avant) => (memesSignalements(avant, suivants) ? avant : suivants));
      setErreur(null);
    } catch {
      if (actif.current) setErreur(MESSAGE_LECTURE_ECHEC);
    } finally {
      if (actif.current) setChargement(false);
    }
  }, []);

  useEffect(() => {
    actif.current = true;
    const depart = setTimeout(() => void rafraichir(), 0);
    const arretLocal = abonnerChangements(() => void rafraichir());
    // Realtime : relecture dès qu'un signalement change ; l'interrogation toutes les 30 s reste le repli.
    const arretRealtime = abonnerSignalementsRealtime(() => void rafraichir());
    const minuteur = setInterval(() => {
      if (etatSource() === 'en_ligne') void rafraichir();
    }, RAFRAICHISSEMENT_MS);
    // Hors ligne : on sonde la connexion, et le renvoi de la file repart dès son retour.
    const sonde = setInterval(() => {
      if (etatSource() === 'repli') {
        void sonderSource().then((e) => {
          if (e === 'en_ligne') void rafraichir();
        });
      }
    }, SONDE_REPLI_MS);
    return () => {
      actif.current = false;
      clearTimeout(depart);
      clearInterval(sonde);
      arretLocal();
      arretRealtime();
      clearInterval(minuteur);
    };
  }, [rafraichir]);

  const cle = JSON.stringify([filtre?.etats ?? null, filtre?.categories ?? null]);
  const signalements = useMemo(
    () => filtrerSignalements(tous, filtre),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tous, cle],
  );
  return { signalements, rafraichir, chargement, erreur };
}
