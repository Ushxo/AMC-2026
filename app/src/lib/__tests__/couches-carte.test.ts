import type { AvisEau, CoucheAvisEau, CoucheChantiers } from '../../types';
import { aireM2, avisVisibles, basculerCouche, chantierEn, COUCHES_PAR_DEFAUT, elementTouche, ficheAvis, ficheChantier, toleranceToucherM, verifierAvis } from '../couches-carte';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const carre = (lng: number, lat: number, d = 0.002): [number, number][] => [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
const avis = (id: string, type: 'ebullition' | 'coupure', lng: number): AvisEau =>
  ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [carre(lng, 45.5)] }, properties: { id, origine: 'officiel', gravite: 'moyenne', type, titre: `Avis ${id}`, adresse: null, debut: '2026-11-20T10:00:00', fin: null, placement: 'geometrie_source' } }) as AvisEau;
const couche = { type: 'FeatureCollection', features: [avis('1', 'ebullition', -73.57), avis('2', 'coupure', -73.5)] } as unknown as CoucheAvisEau;

describe('couches de la carte', () => {
  it('chaque couche se masque et se réaffiche', () => {
    const e = basculerCouche(COUCHES_PAR_DEFAUT, 'coupures');
    expect(e.coupures).toBe(false);
    expect(basculerCouche(e, 'coupures').coupures).toBe(true);
    expect(COUCHES_PAR_DEFAUT.chantiers).toBe(false);
  });
  it('ébullition et coupures se filtrent séparément', () => {
    expect(avisVisibles(couche, COUCHES_PAR_DEFAUT)).toHaveLength(2);
    expect(avisVisibles(couche, { ...COUCHES_PAR_DEFAUT, coupures: false }).map((f) => f.properties.id)).toEqual(['1']);
    expect(avisVisibles(couche, { ...COUCHES_PAR_DEFAUT, coupures: false, ebullition: false })).toEqual([]);
  });
});

describe('sous avis ?', () => {
  it('dit si l’adresse ou la position est sous un avis, même couche masquée', () => {
    const v = verifierAvis({ latitude: 45.5, longitude: -73.57 }, couche, 'adresse');
    expect(v.sous).toBe(true);
    expect(v.message).toBe("Cette adresse est sous un avis d'ébullition.");
    expect(verifierAvis({ latitude: 45.5, longitude: -73.5 }, couche, 'position').message).toBe("Votre position est sous un avis de coupure d'eau.");
  });
  it('dit aussi quand il n’y a aucun avis', () => {
    const v = verifierAvis({ latitude: 45.6, longitude: -73.4 }, couche, 'adresse');
    expect(v.sous).toBe(false);
    expect(v.message).toContain("n'est sous aucun avis");
  });
});

describe('fiche d’un élément', () => {
  it('avis : type, origine, gravité, état, date, source', () => {
    const f = ficheAvis(avis('1', 'ebullition', -73.57));
    const libelles = f.lignes.map((l) => l.etiquette);
    expect(libelles).toEqual(expect.arrayContaining(['Type', 'Origine', 'Gravité', 'État', 'Début', 'Source']));
    expect(f.lignes.find((l) => l.etiquette === 'Type')?.valeur).toBe("Avis d'ébullition");
  });
  it('chantier touché à moins de 40 m, sinon rien', () => {
    const chantiers = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.57, 45.5] }, properties: { id: 'c1', origine: 'officiel', gravite: 'faible', entreprise: 'ACME', debut: '2026-11-01', fin: null } }] } as unknown as CoucheChantiers;
    const f = chantierEn(chantiers, { latitude: 45.50005, longitude: -73.57 });
    expect(f).not.toBeNull();
    expect(ficheChantier(f!).lignes.find((l) => l.etiquette === 'Entreprise')?.valeur).toBe('ACME');
    expect(chantierEn(chantiers, { latitude: 45.51, longitude: -73.57 })).toBeNull();
  });
});

describe('toucher de la carte : n’importe où dans le tracé', () => {
  const grand = avis('grand', 'coupure', -73.57);
  const petit = { ...avis('petit', 'ebullition', -73.57), geometry: { type: 'Polygon', coordinates: [carre(-73.57, 45.5, 0.0005)] } } as AvisEau;
  const vide = { avis: [], chantiers: null, zones: null };

  it('un toucher près du bord ouvre la fiche, pas seulement au centre', () => {
    const bord = { latitude: 45.5 + 0.0019, longitude: -73.57 + 0.0019 }; // tout près d'un coin
    expect(elementTouche(bord, { ...vide, avis: [grand] }, 5)?.id).toBe('avis-grand');
    expect(elementTouche({ latitude: 45.5, longitude: -73.57 }, { ...vide, avis: [grand] }, 5)?.id).toBe('avis-grand');
  });
  it('quand deux se chevauchent, le plus petit gagne', () => {
    expect(elementTouche({ latitude: 45.5, longitude: -73.57 }, { ...vide, avis: [grand, petit] }, 5)?.id).toBe('avis-petit');
    expect(elementTouche({ latitude: 45.5 + 0.0015, longitude: -73.57 }, { ...vide, avis: [grand, petit] }, 5)?.id).toBe('avis-grand');
  });
  it('tolère quelques points autour d’un tracé, mais pas au loin ; hors de tout élément : rien', () => {
    const juste = { latitude: 45.5, longitude: -73.57 + 0.002 + 8 / (111320 * Math.cos((45.5 * Math.PI) / 180)) }; // 8 m hors du bord
    expect(elementTouche(juste, { ...vide, avis: [grand] }, 4)).toBeNull();
    expect(elementTouche(juste, { ...vide, avis: [grand] }, 12)?.id).toBe('avis-grand');
    expect(elementTouche({ latitude: 45.6, longitude: -73.4 }, { ...vide, avis: [grand] }, 12)).toBeNull();
  });
  it('aire et tolérance : valeurs raisonnables', () => {
    expect(aireM2(petit.geometry)).toBeLessThan(aireM2(grand.geometry));
    expect(toleranceToucherM(undefined)).toBe(15);
    expect(toleranceToucherM(0.0001)).toBe(4);
    expect(toleranceToucherM(10)).toBe(80);
  });
});
