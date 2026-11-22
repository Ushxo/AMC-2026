import { useMemo } from 'react';

import { sansNonConfirmes } from '../lib/gravite';
import { calculerResume } from '../lib/resume';
import type { ResumeVille } from '../types';
import { useSignalements } from './use-signalements';

export function useResumeVille(): { resume: ResumeVille; chargement: boolean; erreur: string | null } {
  const { signalements, chargement, erreur } = useSignalements();
  const resume = useMemo(() => calculerResume(sansNonConfirmes(signalements)), [signalements]);
  return { resume, chargement, erreur };
}
