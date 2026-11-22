import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAcces } from '@/hooks/use-acces';
import AuthFlow from '../../frontend/auth/AuthFlow';

/** Connexion unique : citoyen, employé ou superviseur. Une session déjà ouverte renvoie directement à son écran. */
export default function Connexion() {
  const router = useRouter();
  const { ecran } = useAcces();

  useEffect(() => {
    if (ecran === 'citoyen') router.replace('/');
    else if (ecran) router.replace('/ville');
  }, [ecran, router]);

  return <AuthFlow onConnecte={() => {}} />;
}
