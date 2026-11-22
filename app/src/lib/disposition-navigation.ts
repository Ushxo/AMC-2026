/**
 * Disposition de l'écran de navigation.
 *
 * Le panneau du bas n'est PAS posé par-dessus la carte : la carte de navigation s'arrête au haut du panneau (disposition en colonne),
 * donc la caméra de suivi (qui place le véhicule dans le bas de la zone de la carte) ne peut pas le placer derrière le panneau,
 * sans dépendre de la marge (mapPadding) du SDK, que le suivi de caméra n'honore pas sur iOS. Seuls les coins arrondis du panneau
 * mordent sur la carte (RECOUVREMENT_PANNEAU), dans une zone où le véhicule n'est jamais.
 */
export const RECOUVREMENT_PANNEAU = 30;

/** Marge négative du panneau : ses coins arrondis recouvrent le bas de la carte, rien d'autre. */
export const MARGE_HAUTE_PANNEAU = -RECOUVREMENT_PANNEAU;

/**
 * Réglages de la vue de navigation Google. La boussole est un cas à part : le SDK iOS ne la masque pas à l'ouverture (son réglage par
 * défaut est « faux » côté React Native : aucun appel natif n'a lieu quand on passe encore « faux »). On la déclare d'abord visible,
 * puis masquée une fois la carte prête : le changement de valeur déclenche l'appel natif qui la masque vraiment.
 */
export function reglagesVueNavigation(carteSurprete: boolean) {
  return {
    footerEnabled: false,
    tripProgressBarEnabled: false,
    compassEnabled: !carteSurprete,
    speedometerEnabled: false,
    speedLimitIconEnabled: false,
    trafficPromptsEnabled: false,
    trafficIncidentCardsEnabled: false,
    recenterButtonEnabled: true,
    reportIncidentButtonEnabled: false,
    mapPadding: { top: 0, left: 0, right: 0, bottom: 0 },
  } as const;
}

/** « reste 6 h 21 » : la durée restante de la tournée, en deux mots. */
export function libelleResteCourt(secondes: number, formater: (s: number) => string): string {
  return `reste ${formater(secondes)}`;
}
