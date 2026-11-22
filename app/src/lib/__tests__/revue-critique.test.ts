import { retenirPlan } from '../../hooks/use-tournees';
import type { Arret, ResultatOptimisation, Tournee } from '../../types';
import { calculerGuidage, guidageDroit, messageArrivee } from '../guidage';
import { essayerLancer } from '../lancer-navigation';
import { cibleFinTournee } from '../tournees';
import { peutMarquerFait, peutPublierPosition, tourneeTerminee } from '../trajet';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const garage = { latitude: 45.5, longitude: -73.6 };
const arret = (rang: number, lat: number, lng: number): Arret => ({ rang, cle_endroit: `c${rang}`, signalement_ids: ['s'], position: { latitude: lat, longitude: lng }, arrivee_prevue: '', depart_prevu: '' });
const tournee = (fin: Tournee['fin'], finPos?: { latitude: number; longitude: number }): Pick<Tournee, 'fin' | 'fin_position' | 'arrets'> => ({
  fin,
  ...(finPos ? { fin_position: finPos } : {}),
  arrets: [arret(1, 45.51, -73.59), arret(2, 45.52, -73.58)],
});

describe('P4 : dernière destination après le dernier arrêt', () => {
  it('garage seulement quand fin = garage (ou absent)', () => {
    expect(cibleFinTournee(tournee('garage'), garage)).toEqual({ position: garage, nom: 'garage' });
    expect(cibleFinTournee(tournee(undefined), garage)?.nom).toBe('garage');
    expect(cibleFinTournee(tournee('garage'), null)).toBeNull();
  });
  it('rien quand fin = libre', () => {
    expect(cibleFinTournee(tournee('libre', { latitude: 45.52, longitude: -73.58 }), garage)).toBeNull();
  });
  it('fin_position quand fin = endroit, sauf si c’est déjà le dernier arrêt', () => {
    const loin = { latitude: 45.53, longitude: -73.57 };
    expect(cibleFinTournee(tournee('endroit', loin), garage)).toEqual({ position: loin, nom: 'fin' });
    expect(cibleFinTournee(tournee('endroit', { latitude: 45.52, longitude: -73.58 }), garage)).toBeNull();
    expect(cibleFinTournee(tournee('endroit'), garage)).toBeNull();
  });
  it('les mots de l’arrivée et de la direction suivent la destination', () => {
    const fin = { arrivee: 'à la fin de la tournée', direction: 'de la fin de la tournée' };
    expect(messageArrivee(0, fin)).toBe('Vous êtes arrivé à la fin de la tournée');
    expect(messageArrivee(3)).toBe("Vous êtes arrivé à l'arrêt 3");
    const g = guidageDroit({ latitude: 45.5, longitude: -73.6 }, { latitude: 45.51, longitude: -73.6 }, 0, fin);
    expect(g.instruction).toContain('direction de la fin de la tournée');
    expect(calculerGuidage({ position: garage, etapes: [], numeroArret: 0, destination: garage, dest: fin }).instruction).toBe('Vous êtes arrivé à la fin de la tournée');
  });
});

describe('P5 : « Démarrer » après un échec', () => {
  it('un échec de startGuidance ne mémorise pas la destination : le nouvel essai passe', async () => {
    const etat = { verrou: false, derniere: null as string | null };
    const echec = { definirRoute: async () => true, demarrer: async () => { throw new Error('non'); } };
    expect(await essayerLancer(etat, 'a1', echec)).toBe('echec');
    expect(etat).toEqual({ verrou: false, derniere: null });
    const demarrer = jest.fn(async () => {});
    expect(await essayerLancer(etat, 'a1', { definirRoute: async () => true, demarrer })).toBe('ok');
    expect(demarrer).toHaveBeenCalledTimes(1);
    expect(etat.derniere).toBe('a1');
    expect(await essayerLancer(etat, 'a1', { definirRoute: async () => true, demarrer })).toBe('ignore'); // même destination déjà démarrée
  });
  it('route refusée : verrou libéré, destination non retenue', async () => {
    const etat = { verrou: false, derniere: null as string | null };
    expect(await essayerLancer(etat, 'a2', { definirRoute: async () => false, demarrer: async () => {} })).toBe('route');
    expect(etat).toEqual({ verrou: false, derniere: null });
  });
  it('verrou : une seule demande à la fois', async () => {
    const etat = { verrou: false, derniere: null as string | null };
    let fin!: () => void;
    const attente = new Promise<void>((r) => { fin = r; });
    const premier = essayerLancer(etat, 'a3', { definirRoute: async () => true, demarrer: () => attente });
    expect(await essayerLancer(etat, 'a4', { definirRoute: async () => true, demarrer: async () => {} })).toBe('ignore');
    fin();
    expect(await premier).toBe('ok');
  });
});

describe('P6 et P7 : qui publie la position, qui marque un arrêt fait', () => {
  const base = { suiviActif: true, compteDeLEquipe: true, local: false, demoHorsLigne: false, repli: false };
  it('seul le compte de l’équipe, suivi démarré, en ligne', () => {
    expect(peutPublierPosition(base)).toBe(true);
    expect(peutPublierPosition({ ...base, compteDeLEquipe: false })).toBe(false); // un superviseur ne publie rien
    expect(peutPublierPosition({ ...base, suiviActif: false })).toBe(false); // aperçu : rien
    expect(peutPublierPosition({ ...base, demoHorsLigne: true })).toBe(false);
    expect(peutPublierPosition({ ...base, repli: true })).toBe(false);
  });
  it('arrêt fait : superviseur, compte de l’équipe ou démonstration locale', () => {
    expect(peutMarquerFait({ peutGerer: true, compteDeLEquipe: false, local: false })).toBe(true);
    expect(peutMarquerFait({ peutGerer: false, compteDeLEquipe: true, local: false })).toBe(true);
    expect(peutMarquerFait({ peutGerer: false, compteDeLEquipe: false, local: true })).toBe(true);
    expect(peutMarquerFait({ peutGerer: false, compteDeLEquipe: false, local: false })).toBe(false);
  });
});

describe('P9 : fin de tournée limitée à la tournée affichée', () => {
  const arrets = [arret(1, 45.5, -73.5), arret(2, 45.51, -73.5)];
  it('l’échec partiel d’une autre tournée ne retient pas celle-ci', () => {
    const partielAilleurs = (a: Arret) => a.cle_endroit === 'autre';
    expect(tourneeTerminee(arrets, () => true, partielAilleurs)).toBe(true);
  });
  it('un échec partiel sur un arrêt de cette tournée la retient ; un arrêt non fait aussi ; sans arrêt : non', () => {
    expect(tourneeTerminee(arrets, () => true, (a) => a.rang === 2)).toBe(false);
    expect(tourneeTerminee(arrets, (a) => a.rang === 1, () => false)).toBe(false);
    expect(tourneeTerminee([], () => true, () => false)).toBe(false);
  });
});

describe('P10 : le dernier plan valide est gardé', () => {
  const plan = (calcule_le: string) => ({ tournees: [], calcule_le }) as unknown as ResultatOptimisation;
  it('null, invalide ou plus ancien : on garde le plan précédent ; plus récent : il le remplace', () => {
    const a = plan('2026-11-22T10:00:00Z');
    expect(retenirPlan(a, null)).toBe(a);
    expect(retenirPlan(a, { tournees: undefined } as unknown as ResultatOptimisation)).toBe(a);
    expect(retenirPlan(a, plan('2026-11-22T09:00:00Z'))).toBe(a);
    const b = plan('2026-11-22T11:00:00Z');
    expect(retenirPlan(a, b)).toBe(b);
    expect(retenirPlan(null, a)).toBe(a);
    expect(retenirPlan(null, null)).toBeNull();
  });
});
