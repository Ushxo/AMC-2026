/** État d'un lancement de navigation : un verrou pendant la demande, et la dernière destination QUI A DÉMARRÉ. */
export type EtatLancement = { verrou: boolean; derniere: string | null };

export type ResultatLancement = 'ignore' | 'ok' | 'route' | 'echec';

/**
 * Une destination à la fois. Le verrou couvre la demande entière et se libère toujours (succès, route refusée, échec) ;
 * la destination n'est retenue qu'après un démarrage réussi : un échec laisse « Démarrer » utilisable.
 */
export async function essayerLancer(
  etat: EtatLancement,
  cle: string,
  actions: { definirRoute: () => Promise<boolean>; demarrer: () => Promise<void> },
): Promise<ResultatLancement> {
  if (etat.derniere === cle || etat.verrou) return 'ignore';
  etat.verrou = true;
  try {
    if (!(await actions.definirRoute())) return 'route';
    await actions.demarrer();
    etat.derniere = cle;
    return 'ok';
  } catch {
    return 'echec';
  } finally {
    etat.verrou = false;
  }
}
