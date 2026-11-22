import { formaterDate, formaterNombre, formaterPosition } from '../format';

describe('format', () => {
  it('formaterDate', () => {
    expect(formaterDate('2026-11-21T14:05:00')).toBe('21 nov. 2026, 14 h 05');
    expect(formaterDate('pas une date')).toBe('');
  });
  it('formaterNombre', () => {
    expect(formaterNombre(1, 'signalement', 'signalements')).toBe('1 signalement');
    expect(formaterNombre(0, 'signalement', 'signalements')).toBe('0 signalement');
    expect(formaterNombre(3, 'signalement', 'signalements')).toBe('3 signalements');
  });
  it('formaterPosition', () => {
    expect(formaterPosition(45.5, -73.567)).toBe('45.50000, -73.56700');
  });
});
