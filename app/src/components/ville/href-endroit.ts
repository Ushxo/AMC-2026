import type { Href } from 'expo-router';

import type { Endroit } from '@/types';

/** Un seul signalement : sa fiche. Plusieurs : la liste de l'endroit. */
export function hrefEndroit(e: Endroit): Href {
  if (e.signalements.length === 1) {
    return { pathname: '/ville/signalement/[id]', params: { id: e.signalements[0].id } };
  }
  return { pathname: '/ville/endroit', params: { cle: e.cle } };
}
