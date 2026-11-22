import { useTheme } from '@/hooks/use-theme';

/** Couleurs de texte d'erreur et de lien : celles du thème de l'app (jamais le mode clair ou sombre du téléphone). */
export function useCouleursTexte() {
  const P = useTheme();
  return { erreur: P.danger, lien: P.primary };
}
