import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';

/** Coche vectorielle (même famille d'icônes que le reste de l'app) : « choisi », « fait », « lisible ». */
export function Coche({ taille = 16, couleur }: { taille?: number; couleur?: string }) {
  const theme = useTheme();
  return <Ionicons name="checkmark" size={taille} color={couleur ?? theme.primary} accessible={false} />;
}
