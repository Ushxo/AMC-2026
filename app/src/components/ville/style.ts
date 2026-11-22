import type { Gravite } from '@/types';

export const COULEUR_GRAVITE: Record<Gravite, string> = {
  faible: '#1B7F4B',
  moyenne: '#A85A00',
  elevee: '#B3261E',
};

export const COULEUR_ACCENT = '#1F5FBF';
export const CIBLE_MIN = 48;

/** Couleurs de texte avec contraste suffisant en clair et en sombre. */
export const COULEURS_TEXTE = {
  light: { erreur: '#B3261E', lien: '#1F5FBF' },
  dark: { erreur: '#FF8A80', lien: '#8AB4F8' },
} as const;

/** Une couleur par équipe, lisible sur fond clair et sombre et distincte pour le daltonisme (palette Okabe-Ito). */
export const COULEURS_EQUIPES = [
  '#0072B2',
  '#D55E00',
  '#009E73',
  '#CC79A7',
  '#E69F00',
  '#56B4E9',
  '#F0E442',
  '#000000',
] as const;

export function couleurEquipe(index: number): string {
  return COULEURS_EQUIPES[((index % COULEURS_EQUIPES.length) + COULEURS_EQUIPES.length) % COULEURS_EQUIPES.length];
}

export const COULEUR_INCIDENT = '#B3261E';
export const FOND_INCIDENT = 'rgba(179, 38, 30, 0.25)';

/** Texte posé sur un repère de gravité (coche). */
export const COULEUR_SUR_REPERE = '#FFFFFF';

/** Liserés d'un repère de carte : lisible sur fond clair comme sur fond sombre. */
export const LISERE_CLAIR = '#FFFFFF';
export const LISERE_SOMBRE = '#111318';

/** Contraste WCAG du blanc sur une couleur « #RRGGBB » (le chiffre blanc sur un repère orange n'atteint pas 3 pour 1). */
export function contrasteAvecBlanc(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return 1.05 / (L + 0.05);
}

/** Couleur du signe (chiffre, coche, grille) sur un repère : blanc, sauf si le blanc est trop pâle (orange, jaune) : alors foncé. */
export function couleurSigne(hexRepere: string): string {
  return contrasteAvecBlanc(hexRepere) < 3 ? LISERE_SOMBRE : LISERE_CLAIR;
}
/** Repère d'un arrêt déjà fait. */
export const COULEUR_ARRET_FAIT = '#7B8580';

/** Couleurs des repères de bouche d'égout (fournies avec le dessin) : le niveau reste aussi dit en texte. */
export const COULEUR_REPERE: Record<Gravite | 'existant', string> = {
  existant: '#7B8580',
  faible: '#2F7D32',
  moyenne: '#F47B20',
  elevee: '#D9363E',
};

/** Tournée en arrière-plan quand un seul tronçon est mis en avant (accent à 35 %). */
export const COULEUR_TRACE_ATTENUE = 'rgba(31, 95, 191, 0.35)';
export const COULEUR_VEHICULE = COULEUR_ACCENT;

/** Bande d'eau sur la rue : bleu eau translucide (lisible sur les fonds de carte clair et sombre). */
export const COULEUR_BANDE_EAU = 'rgba(30, 136, 229, 0.5)';
export const EPAISSEUR_BANDE_EAU = 16;

/** « #RRGGBB » vers « rgba(r, g, b, a) ». */
export function avecOpacite(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Zones de signalements : remplissage translucide à 20 %, contour de la même couleur à 75 % sur 2 points. */
export const STYLE_ZONE: Record<Gravite, { fond: string; contour: string; epaisseur: number }> = {
  faible: { fond: avecOpacite(COULEUR_REPERE.faible, 0.2), contour: avecOpacite(COULEUR_REPERE.faible, 0.75), epaisseur: 2 },
  moyenne: { fond: avecOpacite(COULEUR_REPERE.moyenne, 0.2), contour: avecOpacite(COULEUR_REPERE.moyenne, 0.75), epaisseur: 2 },
  elevee: { fond: avecOpacite(COULEUR_REPERE.elevee, 0.2), contour: avecOpacite(COULEUR_REPERE.elevee, 0.75), epaisseur: 2 },
};

/**
 * Zones en mode sélection : l'état se lit par l'épaisseur du contour et la densité du remplissage, pas par la couleur seule.
 * toutes = contour épais et remplissage dense ; certaines = intermédiaire ; aucune = fin et clair.
 */
export function styleZoneSelection(gravite: Gravite, etat: 'toutes' | 'certaines' | 'aucune') {
  const base = COULEUR_REPERE[gravite];
  const par = {
    toutes: { fond: 0.45, contour: 1, epaisseur: 6 },
    certaines: { fond: 0.3, contour: 0.9, epaisseur: 3.5 },
    aucune: { fond: 0.1, contour: 0.6, epaisseur: 1.5 },
  }[etat];
  return { fond: avecOpacite(base, par.fond), contour: avecOpacite(base, par.contour), epaisseur: par.epaisseur };
}

/** Zones d'avis d'eau : bleu pétrole, remplissage à 22 %, contour à 75 % sur 2 points. */
export const AVIS_EAU = {
  couleur: '#287F99',
  fond: avecOpacite('#287F99', 0.22),
  contour: avecOpacite('#287F99', 0.75),
  epaisseur: 2,
} as const;
