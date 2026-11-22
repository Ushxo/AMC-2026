import type { Endroit, Gravite } from '../types';

export type CompteSelection = { total: number; elevee: number; moyenne: number; faible: number };

/** Les endroits qu'on peut planifier : ceux qui ont au moins un signalement ouvert. */
export function endroitsOuverts(endroits: Endroit[]): Endroit[] {
  return endroits.filter((e) => e.nombre > 0);
}

export function clesOuvertes(endroits: Endroit[]): string[] {
  return endroitsOuverts(endroits).map((e) => e.cle);
}

/** Ne garde que les clés qui existent encore parmi les endroits ouverts, sans doublon. */
export function nettoyerSelection(cles: string[], endroits: Endroit[]): string[] {
  const ouvertes = new Set(clesOuvertes(endroits));
  return [...new Set(cles)].filter((c) => ouvertes.has(c));
}

/**
 * Bouton « Faible », « Moyenne » ou « Élevée » : sélectionne d'un coup tous les endroits de cette gravité
 * affichée ; si tous le sont déjà, les désélectionne.
 */
export function basculerGravite(cles: string[], endroits: Endroit[], gravite: Gravite): string[] {
  const deLaGravite = endroitsOuverts(endroits)
    .filter((e) => e.gravite_affichee === gravite)
    .map((e) => e.cle);
  if (deLaGravite.length === 0) return cles;
  const choisies = new Set(cles);
  const toutesChoisies = deLaGravite.every((c) => choisies.has(c));
  if (toutesChoisies) return cles.filter((c) => !deLaGravite.includes(c));
  return [...new Set([...cles, ...deLaGravite])];
}

/** Toucher un repère : l'ajoute à la sélection ou le retire. */
export function basculerCle(cles: string[], cle: string): string[] {
  return cles.includes(cle) ? cles.filter((c) => c !== cle) : [...cles, cle];
}

export function compterSelection(cles: string[], endroits: Endroit[]): CompteSelection {
  const choisies = new Set(cles);
  const compte: CompteSelection = { total: 0, elevee: 0, moyenne: 0, faible: 0 };
  for (const e of endroitsOuverts(endroits)) {
    if (!choisies.has(e.cle)) continue;
    compte.total += 1;
    compte[e.gravite_affichee] += 1;
  }
  return compte;
}

/** « 12 endroits sélectionnés (3 élevés, 4 moyens, 5 faibles) » */
export function libelleCompteur(c: CompteSelection): string {
  const endroits = c.total > 1 ? 'endroits sélectionnés' : 'endroit sélectionné';
  const e = c.elevee > 1 ? 'élevés' : 'élevé';
  const m = c.moyenne > 1 ? 'moyens' : 'moyen';
  const f = c.faible > 1 ? 'faibles' : 'faible';
  return `${c.total} ${endroits} (${c.elevee} ${e}, ${c.moyenne} ${m}, ${c.faible} ${f})`;
}

/** Sélection à envoyer au service : absente si tout est choisi (= tous les endroits ouverts). */
export function selectionAEnvoyer(cles: string[], endroits: Endroit[]): string[] | undefined {
  const propres = nettoyerSelection(cles, endroits);
  return propres.length === clesOuvertes(endroits).length ? undefined : propres;
}

export function gravitesDisponibles(endroits: Endroit[]): Record<Gravite, number> {
  const n: Record<Gravite, number> = { faible: 0, moyenne: 0, elevee: 0 };
  for (const e of endroitsOuverts(endroits)) n[e.gravite_affichee] += 1;
  return n;
}
