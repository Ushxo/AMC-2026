import { Redirect } from 'expo-router';

/** L'inscription se fait sur l'écran de compte de l'application (frontend/auth/SignupScreen), via /connexion. */
export default function Inscription() {
  return <Redirect href="/connexion" />;
}
