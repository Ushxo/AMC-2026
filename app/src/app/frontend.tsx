import { Redirect } from 'expo-router';

/** Ancienne adresse du frontend : il est maintenant la racine de l'app. */
export default function Frontend() {
  return <Redirect href="/" />;
}
