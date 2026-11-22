import type { Endroit, Gravite } from '../../types';
import type { Region } from '../config';
import {
  dansRegion,
  decalerInfos,
  type ItemInfo,
  etatSelectionGroupe,
  graviteMoyenne,
  libelleGroupe,
  ECART_MIN_PX,
  niveauGrille,
  niveauStable,
  regrouper,
  SEUIL_ZOOM_REGROUPEMENT,
  tailleCase,
} from '../regroupement';

let n = 0;
function e(lat: number, lng: number, gravite: Gravite = 'faible', nombre = 1): Endroit {
  n += 1;
  return {
    cle: `grille:${n}`,
    position: { latitude: lat, longitude: lng },
    nombre,
    gravite_choisie_max: gravite,
    gravite_par_nombre: 'faible',
    gravite_affichee: gravite,
    etat_dominant: 'nouveau',
    signalements: [],
  };
}

const loin: Region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.06, longitudeDelta: 0.08 };
const HAUTEUR = 360;

describe('regroupement par secteur', () => {
  it('cases : plus on dézoome, plus la case est grande ; carrée au sol (longitude corrigée)', () => {
    const proche = niveauGrille(0.02, HAUTEUR);
    const lointain = niveauGrille(0.2, HAUTEUR);
    expect(lointain).toBeGreaterThan(proche);
    const { dLat, dLng } = tailleCase(proche, 45.5);
    expect(dLng).toBeGreaterThan(dLat); // un degré de longitude est plus court au sol
    expect(dLat * 110540).toBeCloseTo(dLng * 111320 * Math.cos((45.5 * Math.PI) / 180), 0);
    // vise au moins 40 points à l'écran
    expect((dLat / 0.02) * HAUTEUR).toBeGreaterThanOrEqual(40);
  });

  it('deux endroits dans la même case donnent UN groupe au barycentre ; un endroit seul garde son repère', () => {
    const a = e(45.5001, -73.5701);
    const b = e(45.5003, -73.5703);
    const seul = e(45.52, -73.55);
    const r = regrouper([a, b, seul], loin, HAUTEUR);
    expect(r.groupes).toHaveLength(1);
    expect(r.isoles).toEqual([seul]);
    const g = r.groupes[0];
    expect(g.nombre).toBe(2);
    expect(g.position.latitude).toBeCloseTo(45.5002, 6);
    expect(g.position.longitude).toBeCloseTo(-73.5702, 6);
    expect(g.endroits).toEqual([a, b]);
  });

  it('gravité moyenne pondérée par les signalements ouverts, avec les seuils 1,5 et 2,5', () => {
    expect(graviteMoyenne([e(0, 0, 'faible'), e(0, 0, 'faible')])).toBe('faible');
    // (1 + 2) / 2 = 1,5 : pas « moins de 1,5 » donc orange
    expect(graviteMoyenne([e(0, 0, 'faible'), e(0, 0, 'moyenne')])).toBe('moyenne');
    // (1 + 1 + 2) / 3 = 1,33 : vert
    expect(graviteMoyenne([e(0, 0, 'faible'), e(0, 0, 'faible'), e(0, 0, 'moyenne')])).toBe('faible');
    // (2 + 3) / 2 = 2,5 : pas « moins de 2,5 » donc rouge
    expect(graviteMoyenne([e(0, 0, 'moyenne'), e(0, 0, 'elevee')])).toBe('elevee');
    // pondération : un endroit moyen à 10 signalements pèse plus qu'un élevé à 1 : (10×2 + 1×3) / 11 = 2,09 : orange
    expect(graviteMoyenne([e(0, 0, 'moyenne', 10), e(0, 0, 'elevee', 1)])).toBe('moyenne');
    // inversement : un élevé à 10 signalements entraîne le groupe : (1×1 + 10×3) / 11 = 2,8 : rouge
    expect(graviteMoyenne([e(0, 0, 'faible', 1), e(0, 0, 'elevee', 10)])).toBe('elevee');
  });

  it('un endroit élevé n’est jamais caché sans le dire : marque quand la moyenne n’est pas rouge', () => {
    const [g] = regrouper([e(45.5001, -73.5701, 'faible', 5), e(45.5002, -73.5702, 'faible', 5), e(45.5003, -73.5703, 'elevee', 1)], loin, HAUTEUR).groupes;
    expect(g.gravite).toBe('faible');
    expect(g.nombreEleves).toBe(1);
    expect(g.marqueEleve).toBe(true);
    const [rouge] = regrouper([e(45.5001, -73.5701, 'elevee', 5), e(45.5002, -73.5702, 'elevee', 5)], loin, HAUTEUR).groupes;
    expect(rouge.gravite).toBe('elevee');
    expect(rouge.marqueEleve).toBe(false);
    const [vert] = regrouper([e(45.5001, -73.5701), e(45.5002, -73.5702)], loin, HAUTEUR).groupes;
    expect(vert.marqueEleve).toBe(false);
  });

  it('identifiants de groupe stables : même contenu, même identifiant, quel que soit l’ordre ; autre case, autre identifiant', () => {
    const a = e(45.5001, -73.5701);
    const b = e(45.5003, -73.5703);
    const c = e(45.53, -73.54);
    const d = e(45.5301, -73.5401);
    const id1 = regrouper([a, b, c, d], loin, HAUTEUR).groupes.map((g) => g.id).sort();
    const id2 = regrouper([d, c, b, a], loin, HAUTEUR).groupes.map((g) => g.id).sort();
    expect(id1).toEqual(id2);
    expect(new Set(id1).size).toBe(2);
    // un déplacement léger de la carte ne change pas la grille
    const decale = { ...loin, latitude: loin.latitude + 0.001 };
    expect(regrouper([a, b, c, d], decale, HAUTEUR).groupes.map((g) => g.id).sort()).toEqual(id1);
  });

  it('aucun regroupement quand on est assez zoomé', () => {
    const a = e(45.5001, -73.5701);
    const b = e(45.5002, -73.5702);
    const proche: Region = { latitude: 45.5, longitude: -73.57, latitudeDelta: SEUIL_ZOOM_REGROUPEMENT, longitudeDelta: 0.006 };
    const r = regrouper([a, b], proche, HAUTEUR);
    expect(r.groupes).toEqual([]);
    expect(r.isoles).toHaveLength(2);
  });

  it('seule la zone visible est traitée', () => {
    expect(dansRegion({ latitude: 46.5, longitude: -73.57 }, loin)).toBe(false);
    const r = regrouper([e(46.5, -73.57), e(46.5001, -73.5701)], loin, HAUTEUR);
    expect(r.groupes).toEqual([]);
    expect(r.isoles).toEqual([]);
  });

  it('sélection d’un groupe : tous, partiel ou aucun ; libellé d’accessibilité', () => {
    const [g] = regrouper([e(45.5001, -73.5701, 'faible'), e(45.5002, -73.5702, 'elevee'), e(45.5003, -73.5703, 'moyenne')], loin, HAUTEUR).groupes;
    const cles = g.endroits.map((x) => x.cle);
    expect(etatSelectionGroupe(g, () => true)).toBe('tous');
    expect(etatSelectionGroupe(g, () => false)).toBe('aucun');
    expect(etatSelectionGroupe(g, (c) => c === cles[0])).toBe('partiel');
    const libelles = { faible: 'Faible', moyenne: 'Moyenne', elevee: 'Élevée' } as const;
    expect(libelleGroupe(g, (x) => libelles[x])).toBe('Secteur : 3 endroits signalés, gravité moyenne : moyenne, dont 1 élevé. Toucher pour zoomer');
  });
});

describe('stabilité du niveau (hystérésis) et coût', () => {
  it('à la limite entre deux niveaux, le niveau précédent est gardé', () => {
    const h = 600;
    // delta qui donne exactement la limite : niveau brut n, puis un peu plus petit : n - 1
    const limite = (0.0005 * 2 ** 6 * h) / ECART_MIN_PX; // exact = 6 : niveau 6
    expect(niveauGrille(limite, h)).toBe(6);
    const juste = limite * 1.02; // exact un peu au-dessus de 6 : le brut passe à 7
    expect(niveauGrille(juste, h)).toBe(7);
    expect(niveauStable(6, juste, h)).toBe(6); // dans la marge : on reste au niveau 6
    expect(niveauStable(7, limite * 0.99, h)).toBe(7); // et inversement
    expect(niveauStable(6, limite * 1.5, h)).toBe(7); // nettement au-delà : on change
    expect(niveauStable(null, juste, h)).toBe(7);
  });

  it('regrouper : 190 puis 735 endroits en quelques millisecondes (mesure)', () => {
    const faire = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        cle: `e${i}`,
        position: { latitude: 45.49 + ((i * 37) % 100) * 0.0003, longitude: -73.58 + ((i * 91) % 100) * 0.0004 },
        nombre: 1 + (i % 4),
        gravite_choisie_max: 'faible',
        gravite_par_nombre: 'faible',
        gravite_affichee: (['faible', 'moyenne', 'elevee'] as const)[i % 3],
        etat_dominant: 'nouveau',
        signalements: [],
      })) as Endroit[];
    const region = { latitude: 45.505, longitude: -73.56, latitudeDelta: 0.03, longitudeDelta: 0.042 };
    for (const n of [190, 735]) {
      const e = faire(n);
      const t = performance.now();
      for (let k = 0; k < 20; k++) regrouper(e, region, 340);
      console.log(`regrouper(${n} endroits) : ${((performance.now() - t) / 20).toFixed(2)} ms par appel`);
    }
  });
});

describe('regroupement avec éléments d’information (avis, eau accumulée, chantiers, zones)', () => {
  const info = (id: string, lat: number, lng: number, genre: ItemInfo['genre'] = 'ebullition'): ItemInfo => ({ id, genre, position: { latitude: lat, longitude: lng } });

  it('dézoomé : les éléments d’information entrent dans le groupe de leur secteur sans changer le nombre ni la gravité', () => {
    const a = e(45.5001, -73.5701, 'elevee');
    const b = e(45.5003, -73.5703, 'faible');
    const sans = regrouper([a, b], loin, HAUTEUR).groupes[0];
    const r = regrouper([a, b], loin, HAUTEUR, undefined, [info('i1', 45.5002, -73.5702), info('i2', 45.5002, -73.5702, 'chantier')]);
    expect(r.groupes).toHaveLength(1);
    const g = r.groupes[0];
    expect(g.nombre).toBe(2); // compte les signalements seulement
    expect(g.gravite).toBe(sans.gravite);
    expect(g.infos).toHaveLength(2);
    expect(g.nombreAvis).toBe(1); // un avis d'eau, un chantier
    expect(r.infosIsolees).toEqual([]); // plus dessinés un par un
  });

  it('libellé : « 2 avis d’eau » est dit dans le repère de groupe', () => {
    const r = regrouper([e(45.5001, -73.5701), e(45.5003, -73.5703)], loin, HAUTEUR, undefined, [info('i1', 45.5002, -73.5702), info('i2', 45.5002, -73.5702, 'coupure')]);
    expect(libelleGroupe(r.groupes[0], () => 'Faible')).toBe("Secteur : 2 endroits signalés, gravité moyenne : faible, 2 avis d'eau. Toucher pour zoomer");
  });

  it('un secteur sans signalement donne UN groupe « information » à partir de deux éléments, un seul élément reste seul', () => {
    const r = regrouper([], loin, HAUTEUR, undefined, [info('i1', 45.5001, -73.5701), info('i2', 45.5003, -73.5703, 'bande'), info('i3', 45.53, -73.54, 'zone')]);
    expect(r.groupes).toHaveLength(1);
    expect(r.groupes[0].seulementInfo).toBe(true);
    expect(r.groupes[0].nombre).toBe(2);
    expect(r.infosIsolees.map((x) => x.id)).toEqual(['i3']);
    expect(libelleGroupe(r.groupes[0], () => '')).toMatch(/2 éléments d'information \(1 avis d'eau, 1 autre information\)/);
  });

  it('un seul signalement dans le secteur garde son repère ; deux éléments d’information font un groupe « information »', () => {
    const seul = e(45.5001, -73.5701);
    const r = regrouper([seul], loin, HAUTEUR, undefined, [info('i1', 45.5002, -73.5702), info('i2', 45.5003, -73.5703)]);
    expect(r.isoles).toEqual([seul]);
    expect(r.groupes.map((g) => g.seulementInfo)).toEqual([true]);
  });

  it('au zoom de rue, tout s’affiche un par un', () => {
    const a = e(45.5001, -73.5701);
    const b = e(45.5003, -73.5703);
    const rue: Region = { latitude: 45.5, longitude: -73.57, latitudeDelta: SEUIL_ZOOM_REGROUPEMENT, longitudeDelta: 0.005 };
    const r = regrouper([a, b], rue, HAUTEUR, undefined, [info('i1', 45.5002, -73.5702), info('i2', 45.5002, -73.5703)]);
    expect(r.groupes).toEqual([]);
    expect(r.isoles).toHaveLength(2);
    expect(r.infosIsolees).toHaveLength(2);
  });

  it('hors de la zone visible : ignorés', () => {
    const r = regrouper([], loin, HAUTEUR, undefined, [info('i1', 46.5, -73.57)]);
    expect(r.infosIsolees).toEqual([]);
  });

  it('un repère d’information sur un signalement est décalé (le signalement garde sa place) ; deux éléments confondus aussi', () => {
    const rue: Region = { latitude: 45.5, longitude: -73.57, latitudeDelta: 0.003, longitudeDelta: 0.004 };
    const sig = e(45.5, -73.57);
    const out = decalerInfos([info('a', 45.5, -73.57), info('b', 45.5, -73.57, 'bande')], [sig], rue, HAUTEUR);
    expect(out[0].position.longitude).toBeGreaterThan(-73.57);
    expect(out[1].position.longitude).toBeGreaterThan(out[0].position.longitude);
    expect(sig.position).toEqual({ latitude: 45.5, longitude: -73.57 });
    // loin de tout : inchangé
    const libre = info('c', 45.502, -73.57);
    expect(decalerInfos([libre], [sig], rue, HAUTEUR)[0]).toBe(libre);
  });
});
