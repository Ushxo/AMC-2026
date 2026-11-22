import { useCallback, useEffect, useRef, useState } from 'react';

import {
  creerEquipe,
  desactiverEquipe,
  lireEquipes,
  modifierEquipe,
} from '../lib/equipes';
import { MESSAGE_EQUIPE_ECHEC, MESSAGE_EQUIPES_LECTURE_SEULE } from '../lib/messages';
import { chargerPrecalcule } from '../lib/optimisation';
import { etatSource } from '../lib/source';
import type { Equipe, NouvelleEquipe } from '../types';
import { useSource } from './use-source';

export function useEquipes(): {
  equipes: Equipe[];
  creer: (e: NouvelleEquipe) => Promise<string | null>;
  modifier: (id: string, champs: Partial<NouvelleEquipe>) => Promise<string | null>;
  desactiver: (id: string) => Promise<string | null>;
  lectureSeule: boolean;
  chargement: boolean;
  erreur: string | null;
} {
  const { etat } = useSource();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const actif = useRef(true);
  const repli = etat === 'repli';

  const charger = useCallback(async () => {
    if (etatSource() === 'repli') {
      if (actif.current) {
        setEquipes((chargerPrecalcule(false)?.equipes ?? []).filter((e) => !!e && !!e.id));
        setErreur(null);
        setChargement(false);
      }
      return;
    }
    const l = await lireEquipes();
    if (!actif.current) return;
    if (l) {
      setEquipes(l.filter((e) => !!e && !!e.id));
      setErreur(null);
    } else {
      setErreur(MESSAGE_EQUIPE_ECHEC.replace("n'a pas pu être enregistrée", 'ne peuvent pas être chargées'));
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    actif.current = true;
    const t = setTimeout(() => void charger(), 0);
    return () => {
      actif.current = false;
      clearTimeout(t);
    };
  }, [charger, etat]);

  const ecrire = useCallback(
    async (operation: () => Promise<string | null>) => {
      if (etatSource() === 'repli') return MESSAGE_EQUIPES_LECTURE_SEULE;
      const r = await operation();
      if (!r) await charger();
      return r;
    },
    [charger],
  );

  return {
    equipes,
    creer: (e) => ecrire(() => creerEquipe(e)),
    modifier: (id, champs) => ecrire(() => modifierEquipe(id, champs)),
    desactiver: (id) => ecrire(() => desactiverEquipe(id)),
    lectureSeule: repli,
    chargement,
    erreur,
  };
}
