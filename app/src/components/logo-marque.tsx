import { Image } from 'expo-image';

import { imageLogo } from '@/marque/logos';
import { useMarque } from '@/marque/utiliser';

/** Logo de la marque courante (ou de la clé donnée), décoratif : le nom de l'app est écrit à côté. */
export function LogoMarque({ taille = 40, cle }: { taille?: number; cle?: string }) {
  const { organisation } = useMarque();
  return <Image source={imageLogo(cle ?? organisation.logo)} style={{ width: taille, height: taille, borderRadius: taille * 0.22 }} contentFit="cover" accessible={false} />;
}
