import {
  arrondirQuartHeure,
  dateProchainQuart,
  libelleJour,
  decalageMontrealMin,
  formaterDuree,
  formaterHeure,
  formaterKm,
  heureMontreal,
} from '../temps';

describe('temps de Montréal', () => {
  it('décalage : -300 min en hiver, -240 min en été, aux dates de changement', () => {
    expect(decalageMontrealMin(Date.parse('2026-11-22T12:00:00Z'))).toBe(-300);
    expect(decalageMontrealMin(Date.parse('2026-07-01T12:00:00Z'))).toBe(-240);
    // 2026 : passage à l'heure d'été le 8 mars à 2 h, retour le 1er novembre à 2 h.
    expect(decalageMontrealMin(Date.parse('2026-03-08T06:59:00Z'))).toBe(-300);
    expect(decalageMontrealMin(Date.parse('2026-03-08T07:00:00Z'))).toBe(-240);
    expect(decalageMontrealMin(Date.parse('2026-11-01T05:59:00Z'))).toBe(-240);
    expect(decalageMontrealMin(Date.parse('2026-11-01T06:00:00Z'))).toBe(-300);
  });

  it('heureMontreal lit un ISO avec fuseau ou en UTC', () => {
    expect(heureMontreal('2026-11-22T07:01:51-05:00')).toEqual({ jour: '2026-11-22', heures: 7, minutes: 1 });
    expect(heureMontreal('2026-11-22T12:01:51+00:00')).toEqual({ jour: '2026-11-22', heures: 7, minutes: 1 });
    expect(heureMontreal('2026-11-22T03:30:00Z')).toEqual({ jour: '2026-11-21', heures: 22, minutes: 30 });
    expect(heureMontreal('nimporte quoi')).toBeNull();
  });

  it('formaterHeure et arrondi au quart d’heure', () => {
    expect(formaterHeure('2026-11-22T07:01:51-05:00')).toBe('7 h 01');
    expect(arrondirQuartHeure('2026-11-22T07:01:51-05:00')).toBe('7 h 00');
    expect(arrondirQuartHeure('2026-11-22T07:08:00-05:00')).toBe('7 h 15');
    expect(arrondirQuartHeure('2026-11-22T07:53:00-05:00')).toBe('8 h 00');
    expect(arrondirQuartHeure('2026-11-22T23:55:00-05:00')).toBe('0 h 00');
    expect(arrondirQuartHeure('pas une date')).toBe('');
  });

  it('formaterDuree et formaterKm', () => {
    expect(formaterDuree(42 * 60)).toBe('42 min');
    expect(formaterDuree(7 * 3600 + 5 * 60)).toBe('7 h 05');
    expect(formaterKm(225657)).toBe('225,7 km');
    expect(formaterKm(0)).toBe('0,0 km');
  });
});

describe('prochain quart', () => {
  const t = (iso: string) => Date.parse(iso);

  it('avant le début du premier quart : aujourd’hui ; pendant ou après : demain', () => {
    // Le 22 novembre 2026, Montréal = UTC - 5 h.
    expect(dateProchainQuart(t('2026-11-22T11:00:00Z'), ['07:00', '08:00'])).toBe('2026-11-22'); // 6 h
    expect(dateProchainQuart(t('2026-11-22T15:00:00Z'), ['07:00', '08:00'])).toBe('2026-11-23'); // 10 h
    expect(dateProchainQuart(t('2026-11-22T15:00:00Z'), ['11:00', '12:00'])).toBe('2026-11-22'); // avant 11 h
  });

  it('la date est celle de Montréal, pas celle d’UTC, et passe le changement de mois', () => {
    expect(dateProchainQuart(t('2026-12-01T03:00:00Z'), ['07:00'])).toBe('2026-12-01'); // 22 h le 30 novembre à Montréal : le prochain quart est le 1er décembre
  });

  it('sans équipe : minuit sert de début, donc demain', () => {
    expect(dateProchainQuart(t('2026-11-22T15:00:00Z'), [])).toBe('2026-11-23');
  });

  it('libelleJour', () => {
    expect(libelleJour('2026-11-22')).toBe('dimanche 22 novembre');
    expect(libelleJour('2026-12-01')).toBe('mardi 1er décembre');
    expect(libelleJour('2026-11-22T07:00:00-05:00')).toBe('dimanche 22 novembre');
    expect(libelleJour('nimporte quoi')).toBe('');
  });
});
