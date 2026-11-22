import { Stack } from 'expo-router';

import { Entete } from '@/components/ville/entete';
import { ErrorBoundary } from '@/components/ville/erreur-ecran';

export default function LayoutCitoyen() {
  return (
    <Stack screenOptions={{ header: (props) => <Entete {...props} /> }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="signaler" options={{ title: 'Signaler un problème' }} />
      <Stack.Screen name="suivi/[id]" options={{ title: 'Suivi du signalement' }} />
    </Stack>
  );
}

export { ErrorBoundary };
