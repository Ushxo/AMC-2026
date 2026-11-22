import type { Signalement } from '../../types';
import { bandesInondation, libelleBande, nomDeRue } from '../inondation';
import { longueurPolyligneM, projeterSurPolyligne, sousPolyligne, tronconsProches, type DonneesTroncons } from '../troncons';

const KM = 1 / 110574; // un mètre en degrés de latitude
const KX = 1 / (111320 * Math.cos((45.5 * Math.PI) / 180)); // un mètre en degrés de longitude
const LNG = -73.57;
const LAT = 45.5;
const pt = (nord: number, est = 0): [number, number] => [LNG + est * KX, LAT + nord * KM];

// Un mini réseau : rue Barré (nord-sud, 3 points, 300 m), rue Courte (nord-sud, 60 m), rue Parallèle à 40 m à l'est (300 m).
const donnees: DonneesTroncons = {
  grille: { pas: 0.002, latitudeMin: 45.49, longitudeMin: -73.58 },
  troncons: [
    { id: 1, nom: 'rue barre', libelle: 'rue Barré', points: [pt(-150), pt(0), pt(150)] },
    { id: 2, nom: 'rue courte', libelle: 'rue Courte', points: [pt(500), pt(560)] },
    { id: 3, nom: 'rue parallele', libelle: 'rue Parallèle', points: [pt(-150, 40), pt(150, 40)] },
  ],
  cases: {},
};
// Les cases de la grille couvrent la zone des trois tronçons.
for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) donnees.cases[`${i}_${j}`] = [0, 1, 2];

const sig = (id: string, nord: number, est = 0, categorie: Signalement['categorie'] = 'eau_accumulee', etat: Signalement['etat'] = 'nouveau') =>
  ({ id, categorie, etat, latitude: LAT + nord * KM, longitude: LNG + est * KX }) as unknown as Signalement;
const adresses = [{ libelle: '100 rue Barré', latitude: LAT, longitude: LNG }];

describe('réseau routier : géométrie', () => {
  it('longueur, projection et découpe suivent les points réels', () => {
    const l = donnees.troncons[0].points;
    expect(longueurPolyligneM(l)).toBeGreaterThan(299);
    expect(longueurPolyligneM(l)).toBeLessThan(301);
    const pr = projeterSurPolyligne({ latitude: LAT + 50 * KM, longitude: LNG + 10 * KX }, l);
    expect(pr.distanceM).toBeCloseTo(10, 0);
    expect(pr.abscisseM).toBeCloseTo(200, 0);
    const morceau = sousPolyligne(l, 100, 190);
    expect(morceau.length).toBeGreaterThanOrEqual(3); // passe par le point du milieu (abscisse 150)
    expect(morceau[0].latitude).toBeCloseTo(LAT - 50 * KM, 5);
  });
  it('le tronçon le plus proche vient en premier, au plus loin du rayon donné', () => {
    const proches = tronconsProches({ latitude: LAT, longitude: LNG + 5 * KX }, 60, donnees);
    expect(proches.map((t) => t.troncon.id)).toEqual([1, 3]);
    expect(tronconsProches({ latitude: LAT, longitude: LNG + 5 * KX }, 20, donnees).map((t) => t.troncon.id)).toEqual([1]);
    expect(tronconsProches({ latitude: LAT + 1, longitude: LNG }, 60, donnees)).toEqual([]);
  });
});

describe("bandes d'inondation sur les rues réelles", () => {
  it('nomme la rue sans le numéro', () => {
    expect(nomDeRue('1244-1256 rue Barré')).toBe('rue Barré');
    expect(libelleBande({ rue: 'rue Barré' })).toBe('Eau accumulée sur rue Barré');
  });

  it('découpe 45 m de part et d’autre du point projeté, en suivant le tronçon', () => {
    const [b] = bandesInondation([sig('1', 50, 4)], adresses, donnees);
    expect(b.rue).toBe('rue Barré');
    expect(b.traces).toHaveLength(1);
    const longueur = longueurPolyligneM(b.traces[0].map((c) => [c.longitude, c.latitude] as [number, number]));
    expect(longueur).toBeGreaterThan(88);
    expect(longueur).toBeLessThan(92);
    for (const c of b.traces[0]) expect(Math.abs(c.longitude - LNG) / KX).toBeLessThan(1); // reste sur la rue
  });

  it('préfère la rue de l’adresse la plus proche quand deux rues sont à portée', () => {
    // à 30 m de la rue Barré et 10 m de la rue Parallèle : l'adresse dit « rue Barré »
    const [b] = bandesInondation([sig('1', 0, 30)], adresses, donnees);
    expect(b.rue).toBe('rue Barré');
  });

  it('tronçon court : entier ; plusieurs signalements du même tronçon : une seule bande', () => {
    const [courte] = bandesInondation([sig('c', 530)], [], donnees);
    expect(courte.rue).toBe('rue Courte');
    expect(longueurPolyligneM(courte.traces[0].map((c) => [c.longitude, c.latitude] as [number, number]))).toBeGreaterThan(59);
    const bandes = bandesInondation([sig('1', 10), sig('2', 50)], adresses, donnees);
    expect(bandes).toHaveLength(1);
    expect(bandes[0].signalement_ids).toEqual(['1', '2']);
    expect(bandes[0].traces).toHaveLength(1); // les parties se touchent : réunies
    expect(longueurPolyligneM(bandes[0].traces[0].map((c) => [c.longitude, c.latitude] as [number, number]))).toBeGreaterThan(125);
  });

  it('deux signalements éloignés sur le même tronçon : deux parties dans la même bande', () => {
    const [b] = bandesInondation([sig('1', -120), sig('2', 120)], adresses, donnees);
    expect(b.traces).toHaveLength(2);
  });

  it('rien trouvé, autre type, signalement réglé ou pas de réseau : rien n’est dessiné', () => {
    expect(bandesInondation([sig('1', 0, 500)], adresses, donnees)).toEqual([]);
    expect(bandesInondation([sig('1', 0, 0, 'grille_bouchee')], adresses, donnees)).toEqual([]);
    expect(bandesInondation([sig('1', 0, 0, 'eau_accumulee', 'regle')], adresses, donnees)).toEqual([]);
    expect(bandesInondation([sig('1', 0)], adresses, null)).toEqual([]);
  });
});
