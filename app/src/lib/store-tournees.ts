// État partagé entre les hooks des tournées : bascule sur le précalculé et incident de démo affiché.

type Etat = { forcerPrecalcule: boolean; incidentDemo: boolean; version: number };

let etat: Etat = { forcerPrecalcule: false, incidentDemo: false, version: 0 };
const ecouteurs = new Set<() => void>();

export function lireEtatTournees(): Etat {
  return etat;
}

export function modifierEtatTournees(champs: Partial<Omit<Etat, 'version'>>): void {
  const change = Object.entries(champs).some(([k, v]) => etat[k as keyof Etat] !== v);
  if (!change) return;
  etat = { ...etat, ...champs, version: etat.version + 1 };
  ecouteurs.forEach((f) => f());
}

/** Signale que les données ont changé (nouveau résultat à relire). */
export function notifierTournees(): void {
  etat = { ...etat, version: etat.version + 1 };
  ecouteurs.forEach((f) => f());
}

export function abonnerTournees(f: () => void): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}

export function reinitialiserEtatTournees(): void {
  etat = { forcerPrecalcule: false, incidentDemo: false, version: 0 };
  ecouteurs.forEach((f) => f());
}
