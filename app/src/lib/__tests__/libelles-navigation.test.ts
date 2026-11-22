import { libelleProblemeEtLieu, libelleProchainArret, libelleTempsRestant } from '../libelles-navigation';

describe('libellés du panneau de navigation', () => {
  it('temps restant : moins d’une minute, minutes, heures', () => {
    expect(libelleTempsRestant(20)).toBe("moins d'une minute");
    expect(libelleTempsRestant(240)).toBe('4 min');
    expect(libelleTempsRestant(3600 + 300)).toBe('1 h 05');
    expect(libelleTempsRestant(-1)).toBe('');
  });

  it('ligne principale : « 4 min · 1,2 km » ; vide sans donnée', () => {
    expect(libelleProchainArret({ secondes: 240, metres: 1200 })).toBe('4 min · 1,2 km');
    expect(libelleProchainArret({ secondes: 90, metres: 300 })).toMatch(/^2 min · /);
    expect(libelleProchainArret(null)).toBeNull();
  });

  it('problème et adresse en une ligne', () => {
    expect(libelleProblemeEtLieu('Égout bouché', 'Près de 900 place Jean-Paul-Riopelle')).toBe('Égout bouché · Près de 900 place Jean-Paul-Riopelle');
    expect(libelleProblemeEtLieu('Égout bouché', '')).toBe('Égout bouché');
    expect(libelleProblemeEtLieu('', '')).toBeNull();
  });
});

import { etatArretNavigation } from '../libelles-navigation';

describe('repères d’arrêts sur la carte de navigation', () => {
  const arrets = Array.from({ length: 8 }, (_, i) => ({ rang: i + 1 }));
  const faits = new Set([1, 2]);
  const estFait = (a: { rang: number }) => faits.has(a.rang);
  const courant = arrets[2]; // arrêt 3

  it('fait en gris, prochain avec halo, les deux suivants en clair, les autres atténués', () => {
    const etats = arrets.map((a) => etatArretNavigation(a, arrets, courant, estFait));
    expect(etats).toEqual(['fait', 'fait', 'prochain', 'normal', 'normal', 'attenue', 'attenue', 'attenue']);
  });

  it('sans prochain arrêt (tournée finie) : rien n’est atténué', () => {
    expect(etatArretNavigation(arrets[5], arrets, null, estFait)).toBe('normal');
  });
});
