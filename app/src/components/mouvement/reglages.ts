// Réglages communs des mouvements de l'interface : courts (150 à 300 ms), ressort doux, jamais de retard sur une action.

export const DUREE_BREVE_MS = 150;
export const DUREE_NORMALE_MS = 220;
export const DUREE_LONGUE_MS = 300;

/** Ressort doux : se pose sans rebondir plusieurs fois. */
export const RESSORT_DOUX = { damping: 20, stiffness: 240, mass: 0.8 } as const;
/** Ressort un peu plus vif : retour élastique d'un bouton relâché. */
export const RESSORT_VIF = { damping: 16, stiffness: 320, mass: 0.6 } as const;

/** Échelle d'un bouton pressé. */
export const ECHELLE_PRESSE = 0.97;
/** Échelle de pointe du rebond d'une icône d'onglet qui s'active. */
export const ECHELLE_REBOND = 1.08;
