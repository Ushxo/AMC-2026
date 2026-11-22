import type { Signalement } from '../../types';
import { bandesInondation, libelleBande, nomDeRue } from '../inondation';

const M = 1 / 110540; // un mètre en degrés de latitude
const adr = (libelle: string, nord: number, est = 0) => ({ libelle, latitude: 45.5 + nord * M, longitude: -73.57 + est * (1 / (111320 * Math.cos((45.5 * Math.PI) / 180))) });
const sig = (id: string, nord: number, categorie: Signalement['categorie'] = 'eau_accumulee', etat: Signalement['etat'] = 'nouveau') =>
  ({ id, categorie, etat, latitude: 45.5 + nord * M, longitude: -73.57 }) as unknown as Signalement;

// Une rue qui va du sud au nord (même longitude).
const rueNord = [adr('100 rue Barré', -60), adr('rue Barré', -20), adr('120 rue Barré', 40), adr('140 rue Barré', 90), adr('50 rue Autre', 10, 70)];

describe('bandes d\'inondation', () => {
  it('nomme la rue sans le numéro', () => {
    expect(nomDeRue('1244-1256 rue Barré')).toBe('rue Barré');
    expect(nomDeRue('rue William')).toBe('rue William');
    expect(libelleBande({ rue: 'rue Barré' })).toBe('Eau accumulée sur rue Barré');
  });

  it('trace une bande le long de la rue, d\'environ 90 m', () => {
    const [b] = bandesInondation([sig('1', 0)], rueNord);
    expect(b.rue).toBe('rue Barré');
    const [a, c] = b.points;
    const longueur = Math.hypot((a.latitude - c.latitude) / M, ((a.longitude - c.longitude) * 111320 * Math.cos((45.5 * Math.PI) / 180)));
    expect(longueur).toBeGreaterThan(80);
    expect(longueur).toBeLessThan(100);
    // la rue va du sud au nord : la longitude ne change presque pas
    expect(Math.abs(a.longitude - c.longitude) * 111320).toBeLessThan(5);
  });

  it('fusionne les signalements proches de la même rue en une seule bande plus longue', () => {
    const bandes = bandesInondation([sig('1', 0), sig('2', 60)], rueNord);
    expect(bandes).toHaveLength(1);
    expect(bandes[0].signalement_ids).toEqual(['1', '2']);
    const [a, c] = bandes[0].points;
    expect(Math.abs(a.latitude - c.latitude) / M).toBeGreaterThan(130);
  });

  it('ne dessine rien sans rue connue, sans voisin, ni pour un autre type ou un signalement réglé', () => {
    expect(bandesInondation([sig('1', 0)], [])).toEqual([]);
    expect(bandesInondation([sig('1', 0)], [adr('rue Seule', 5)])).toEqual([]);
    expect(bandesInondation([sig('1', 0, 'grille_bouchee')], rueNord)).toEqual([]);
    expect(bandesInondation([sig('1', 0, 'eau_accumulee', 'regle')], rueNord)).toEqual([]);
  });
});
