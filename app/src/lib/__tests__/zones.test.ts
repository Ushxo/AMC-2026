import { sig } from '../test-utils/fabrique';
import { calculerZones, calculerZonesMemo, CATEGORIES_ZONE, MIN_ENDROITS_ZONE, RAYON_ZONE_M, zoneEn } from '../zones';

const BASE = { latitude: 45.5, longitude: -73.57 };
const M_LAT = 1 / 110540;
const M_LNG = 1 / (111320 * Math.cos((BASE.latitude * Math.PI) / 180));

/** Signalement à (nord, est) mètres du point de base. */
function a(nord: number, est: number, p: Parameters<typeof sig>[0] = {}) {
  return sig({ latitude: BASE.latitude + nord * M_LAT, longitude: BASE.longitude + est * M_LNG, categorie: 'grille_bouchee', ...p });
}

describe('zones de signalements', () => {
  it('un endroit isolé n’a pas de zone, même avec beaucoup de signalements au même point', () => {
    expect(MIN_ENDROITS_ZONE).toBe(2);
    expect(RAYON_ZONE_M).toBe(30);
    expect(calculerZones([a(0, 0)])).toEqual([]);
    expect(calculerZones(Array.from({ length: 55 }, () => a(0, 0)))).toEqual([]);
  });

  it('deux endroits distincts proches donnent une zone de disques fusionnés, sans trou', () => {
    const zones = calculerZones([a(0, 0), a(0, 40)]);
    expect(zones).toHaveLength(1);
    expect(zones[0].polygones[0].exterieur.length).toBeGreaterThan(28);
    expect(zones[0].polygones[0].trous).toEqual([]);
    expect(zones[0].signalement_ids).toHaveLength(2);
  });

  it('deux signalements proches (disques qui se chevauchent) fusionnent en une zone ; deux éloignés en font deux', () => {
    expect(calculerZones([a(0, 0), a(0, 40)])).toHaveLength(1); // 40 m < 60 m
    expect(calculerZones([a(0, 0), a(0, 200)])).toEqual([]); // deux endroits isolés : aucune zone
    const deux = calculerZones([a(0, 0), a(0, 40), a(0, 300), a(0, 340)]);
    expect(deux).toHaveLength(2);
    expect(deux.every((z) => z.signalement_ids.length === 2)).toBe(true);
    // chaîne : A-B proches, B-C proches, A-C loin : une seule zone
    const chaine = calculerZones([a(0, 0), a(0, 50), a(0, 100)]);
    expect(chaine).toHaveLength(1);
    expect(chaine[0].signalement_ids).toHaveLength(3);
  });

  it('la zone prend la gravité MAXIMALE de ses signalements', () => {
    const z = calculerZones([a(0, 0, { gravite: 'faible' }), a(0, 30, { gravite: 'elevee' }), a(0, 60, { gravite: 'moyenne' })]);
    expect(z).toHaveLength(1);
    expect(z[0].gravite).toBe('elevee');
    const moyen = calculerZones([a(0, 0, { gravite: 'faible' }), a(0, 30, { gravite: 'moyenne' })]);
    expect(moyen[0].gravite).toBe('moyenne');
  });

  it('dates du premier et du dernier signalement, et nombre', () => {
    const z = calculerZones([
      a(0, 0, { cree_le: '2026-11-20T10:00:00.000Z' }),
      a(0, 30, { cree_le: '2026-11-22T08:00:00.000Z' }),
      a(0, 60, { cree_le: '2026-11-21T09:00:00.000Z' }),
    ]);
    expect(z[0].premier_le).toBe('2026-11-20T10:00:00.000Z');
    expect(z[0].dernier_le).toBe('2026-11-22T08:00:00.000Z');
    expect(z[0].signalement_ids).toHaveLength(3);
  });

  it('un signalement réglé ou rejeté est retiré : la zone est recalculée, et disparaît s’il n’en reste aucun actif', () => {
    const s1 = a(0, 0);
    const s2 = a(0, 40);
    expect(calculerZones([s1, s2])).toHaveLength(1);
    expect(calculerZones([s1, { ...s2, etat: 'regle' }])).toEqual([]); // il ne reste qu'un endroit actif
    expect(calculerZones([{ ...s1, etat: 'regle' }, { ...s2, etat: 'rejete' }])).toEqual([]);
    expect(calculerZones([])).toEqual([]);
    expect(calculerZones([{ ...s1, etat: 'pris_en_charge' }, s2])).toHaveLength(1);
  });

  it('seules les catégories d’inondation créent une zone', () => {
    expect(CATEGORIES_ZONE).toEqual(['grille_bouchee', 'eau_accumulee']);
    expect(calculerZones([a(0, 0, { categorie: 'eau_accumulee' }), a(0, 40)])).toHaveLength(1);
    expect(calculerZones([a(0, 0, { categorie: 'eau_douteuse' }), a(0, 5, { categorie: 'absence_eau' }), a(0, 9, { categorie: 'autre' })])).toEqual([]);
  });

  it('identifiant stable : même ensemble, même identifiant, quel que soit l’ordre ; autre ensemble, autre identifiant', () => {
    const s = [a(0, 0), a(0, 40), a(500, 500)];
    const ids = (l: typeof s) => calculerZones(l).map((z) => z.id).sort();
    expect(ids(s)).toEqual(ids([...s].reverse()));
    expect(ids(s)[0]).toMatch(/^zone-[0-9a-f]+$/);
    expect(ids([s[0], s[1], a(0, 70)])).not.toEqual(ids([s[0], s[1]]));
  });

  it('trou géré : un anneau de disques autour d’un vide donne une zone avec un trou', () => {
    const rayon = 100;
    const anneau = Array.from({ length: 16 }, (_, i) => {
      const t = (2 * Math.PI * i) / 16;
      return a(Math.sin(t) * 120, Math.cos(t) * 120);
    });
    const zones = calculerZones(anneau, 40);
    expect(rayon).toBeGreaterThan(0);
    expect(zones).toHaveLength(1);
    expect(zones[0].polygones[0].trous.length).toBeGreaterThanOrEqual(1);
    // le centre du vide n'est dans aucune zone ; un signalement de l'anneau l'est
    expect(zoneEn(zones, BASE)).toBeNull();
    expect(zoneEn(zones, { latitude: anneau[0].latitude, longitude: anneau[0].longitude })).not.toBeNull();
  });

  it('retrouve la zone d’un point touché', () => {
    const zones = calculerZones([a(0, 0), a(0, 40), a(0, 400), a(0, 440)]);
    expect(zones).toHaveLength(2);
    expect(zoneEn(zones, { latitude: BASE.latitude + 10 * M_LAT, longitude: BASE.longitude })).toBe(zones.find((z) => zoneEn([z], BASE)));
    expect(zoneEn(zones, { latitude: BASE.latitude + 150 * M_LAT, longitude: BASE.longitude + 150 * M_LNG })).toBeNull();
  });

  it('mémoïsé : même liste, même résultat sans recalcul ; la liste change, nouveau calcul', () => {
    const s = [a(0, 0), a(0, 40), a(0, 80)];
    const r1 = calculerZonesMemo(s);
    expect(calculerZonesMemo([...s])).toBe(r1);
    expect(calculerZonesMemo([s[0], s[1]])).not.toBe(r1);
  });

  it('performance : environ 230 disques fusionnés en quelques centaines de millisecondes', () => {
    const l = Array.from({ length: 230 }, (_, i) => a(((i * 37) % 900) - 450, ((i * 91) % 1400) - 700, { gravite: i % 3 === 0 ? 'elevee' : 'faible' }));
    const debut = Date.now();
    const zones = calculerZones(l);
    const ms = Date.now() - debut;
    console.log(`calculerZones(230 signalements) : ${ms} ms, ${zones.length} zones`);
    expect(zones.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(3000);
    expect(zones.reduce((n, z) => n + z.signalement_ids.length, 0)).toBeLessThanOrEqual(230);
  });

  it('pire cas : 230 signalements dans une même zone dense', () => {
    const l = Array.from({ length: 230 }, (_, i) => a(((i * 37) % 160) - 80, ((i * 91) % 220) - 110));
    const debut = Date.now();
    const zones = calculerZones(l);
    const ms = Date.now() - debut;
    console.log(`calculerZones(230 signalements groupés) : ${ms} ms, ${zones.length} zone(s)`);
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(ms).toBeLessThan(5000);
  });
});
