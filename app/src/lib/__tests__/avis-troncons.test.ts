import type { AvisEau, CoucheAvisEau } from '../../types';
import { distanceTraceAvisM, infoAvis, tracesAvis } from '../avis-troncons';
import { avisVisibles, COUCHES_PAR_DEFAUT, elementTouche, ficheAvis, verifierAvis } from '../couches-carte';
import { tronconParId } from '../troncons';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Les vrais fichiers : avis officiels de la copie locale et tracés des rues (Géobase).
const couche = require('../../donnees/avis-eau.json') as CoucheAvisEau;
const parId = (id: string) => couche.features.find((f) => f.properties.id === id) as AvisEau;
const vide = { avis: [], chantiers: null, zones: null };

describe('avis d’eau le long des vraies rues', () => {
  it('un avis en ligne est tracé sur ses tronçons de rue, pas sur un polygone élargi', () => {
    const a = parId('498');
    expect(infoAvis(a)?.forme).toBe('ligne');
    const traces = tracesAvis(a);
    expect(traces).not.toBeNull();
    expect(traces!.length).toBe(infoAvis(a)!.troncons.length);
    const t = tronconParId(infoAvis(a)!.troncons[0])!;
    expect(traces![0][0]).toEqual({ longitude: t.points[0][0], latitude: t.points[0][1] });
  });

  it('un secteur officiel est dessiné tel quel (aucun tracé de rue)', () => {
    const a = parId('558');
    expect(infoAvis(a)?.forme).toBe('polygone');
    expect(tracesAvis(a)).toBeNull();
  });

  it('un avis en ligne se touche à quelques points de la rue, pas au loin ; sa fiche liste les rues', () => {
    const a = parId('498');
    const t = tronconParId(infoAvis(a)!.troncons[0])!;
    const surLaRue = { longitude: t.points[0][0], latitude: t.points[0][1] };
    const decalee = { latitude: surLaRue.latitude + 8 / 110574, longitude: surLaRue.longitude }; // 8 m
    const loin = { latitude: surLaRue.latitude + 90 / 110574, longitude: surLaRue.longitude };
    expect(distanceTraceAvisM(surLaRue, a)).toBeLessThan(1);
    expect(elementTouche(decalee, { ...vide, avis: [a] }, 5)?.id).toBe('avis-498');
    expect(elementTouche(loin, { ...vide, avis: [a] }, 5)).toBeNull();
    const fiche = ficheAvis(a);
    expect(fiche.lignes.find((l) => l.etiquette.startsWith('Rue'))?.valeur).toContain('René-Lévesque');
    expect(fiche.lignes.find((l) => l.etiquette === 'Source')?.valeur).toContain('CC BY 4.0');
  });

  it('un secteur se touche n’importe où dedans', () => {
    const a = parId('558');
    const centre = { latitude: 45.4944, longitude: -73.5788 }; // dans le polygone officiel
    expect(elementTouche(centre, { ...vide, avis: [a] }, 4)?.id).toBe('avis-558');
  });

  it('« sous avis ? » suit le tracé de la rue (25 m) pour une ligne, le secteur pour un polygone', () => {
    const a = parId('498');
    const t = tronconParId(infoAvis(a)!.troncons[0])!;
    const sur = { longitude: t.points[0][0], latitude: t.points[0][1] };
    expect(verifierAvis(sur, couche, 'adresse').sous).toBe(true);
    expect(verifierAvis({ latitude: sur.latitude + 60 / 110574, longitude: sur.longitude }, couche, 'adresse').avis.some((x) => x.properties.id === '498')).toBe(false);
    expect(avisVisibles(couche, COUCHES_PAR_DEFAUT).length).toBe(couche.features.length);
  });
});
