import { Redirect, Stack, useSegments } from 'expo-router';

import { Entete } from '@/components/ville/entete';
import { ErrorBoundary } from '@/components/ville/erreur-ecran';
import { useSessionEmploye } from '@/hooks/use-session-employe';

/** Garde du mode Ville : sans session employé, tout mène à la connexion. */
export default function VilleLayout() {
  const { employe } = useSessionEmploye();
  const segments = useSegments() as string[];
  const dernier = segments[segments.length - 1];
  const surConnexion = dernier === 'connexion' || dernier === 'inscription';
  if (!employe && !surConnexion) return <Redirect href="/ville/connexion" />;
  // Les en-têtes sont déclarés ici, pas dans chaque écran, et affichés par défaut : la zone sûre est alors
  // calculée avec l'en-tête dès le premier affichage, et rien ne passe sous la barre de navigation.
  return (
    <Stack screenOptions={{ headerShown: true, header: (props) => <Entete {...props} /> }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="connexion" options={{ headerShown: false }} />
      <Stack.Screen name="inscription" options={{ headerShown: false }} />
      <Stack.Screen name="tournees" options={{ title: 'Tournées des équipes' }} />
      <Stack.Screen name="equipes" options={{ title: 'Équipes' }} />
      <Stack.Screen name="equipe/[id]" options={{ title: 'Équipe' }} />
      <Stack.Screen name="trajet/[equipe]" options={{ title: 'Suivre le trajet' }} />
      <Stack.Screen name="carte" options={{ title: 'Carte des signalements' }} />
      <Stack.Screen name="endroit" options={{ title: 'Signalements de l\u2019endroit' }} />
      <Stack.Screen name="signalement/[id]" options={{ title: 'Signalement' }} />
    </Stack>
  );
}

// Une erreur de rendu dans le mode Ville affiche « Un problème est survenu. » avec un bouton Réessayer.
export { ErrorBoundary };
