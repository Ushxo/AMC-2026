import {
  aidePosition,
  finIncomplete,
  libelleArrivee,
  libelleGarage,
  OPTIONS_PAR_DEFAUT,
  parametresDesOptions,
  positionRecente,
  resumeOptions,
} from '../options-calcul';

const MAINTENANT = Date.parse('2026-11-22T22:30:00Z');

describe('options du calcul, par équipe', () => {
  it('par défaut : rien à joindre à la demande (tout le monde part du garage et y revient)', () => {
    expect(parametresDesOptions(OPTIONS_PAR_DEFAUT)).toEqual({});
    expect(finIncomplete(OPTIONS_PAR_DEFAUT)).toBe(false);
  });

  it('seul ce qui s’écarte du défaut est envoyé, équipe par équipe', () => {
    const o = {
      ...OPTIONS_PAR_DEFAUT,
      departParEquipe: { e1: 'position' as const, e2: 'garage' as const },
      finParEquipe: { e1: 'arrivee' as const, e3: 'libre' as const },
    };
    expect(parametresDesOptions(o)).toEqual({ depart_par_equipe: { e1: 'position' }, fin_par_equipe: { e3: 'libre' } });
  });

  it('« Finir à un endroit » (global) : incomplet sans endroit, envoyé avec', () => {
    const sans = { ...OPTIONS_PAR_DEFAUT, finEndroit: true };
    expect(finIncomplete(sans)).toBe(true);
    expect(parametresDesOptions(sans)).toEqual({});
    expect(parametresDesOptions({ ...sans, finCle: 'k1' })).toEqual({ fin: 'endroit', fin_cle_endroit: 'k1' });
  });

  it('position récente : moins de 15 minutes', () => {
    expect(positionRecente({ maj_le: '2026-11-22T22:20:00Z' }, MAINTENANT)).toBe(true);
    expect(positionRecente({ maj_le: '2026-11-22T22:10:00Z' }, MAINTENANT)).toBe(false);
    expect(positionRecente(undefined, MAINTENANT)).toBe(false);
    expect(aidePosition(undefined, MAINTENANT)).toBe('Aucune position récente.');
    expect(aidePosition({ maj_le: '2026-11-22T22:10:00Z' }, MAINTENANT)).toContain('Aucune position récente');
    expect(aidePosition({ maj_le: '2026-11-22T22:20:00Z' }, MAINTENANT)).toContain('Dernière position à');
  });

  it('libellés : garage ou adresse d’arrivée, avec l’adresse en clair', () => {
    expect(libelleGarage({ garage_adresse: '800 rue X' })).toBe('Garage (800 rue X)');
    expect(libelleGarage({})).toBe('Garage');
    expect(libelleArrivee({ garage_adresse: '800 rue X' })).toBe('Garage (800 rue X)');
    expect(libelleArrivee({ arrivee: { latitude: 45.5, longitude: -73.5 }, arrivee_adresse: '12 rue Y' })).toBe("Adresse d'arrivée (12 rue Y)");
  });

  it('résumé replié en une ligne', () => {
    const ids = ['e1', 'e2', 'e3', 'e4'];
    expect(resumeOptions(OPTIONS_PAR_DEFAUT, ids)).toBe('4 équipes au garage');
    expect(resumeOptions({ ...OPTIONS_PAR_DEFAUT, departParEquipe: { e1: 'position' } }, ids)).toBe('3 équipes au garage, 1 à sa position');
    expect(
      resumeOptions({ ...OPTIONS_PAR_DEFAUT, departParEquipe: { e1: 'position', e2: 'position' }, finParEquipe: { e3: 'libre' } }, ids),
    ).toBe('2 équipes au garage, 2 à leur position, 1 finit au dernier arrêt');
    expect(resumeOptions(OPTIONS_PAR_DEFAUT, [])).toBe('Aucune équipe');
  });
});
