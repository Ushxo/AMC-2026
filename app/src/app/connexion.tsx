import { Redirect } from 'expo-router';

/** La connexion est la racine de l'app : sans session, « / » montre l'écran de connexion. */
export default function Connexion() {
  return <Redirect href="/" />;
}
