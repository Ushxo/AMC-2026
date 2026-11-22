import { sig } from '../../lib/test-utils/fabrique';
import { memesSignalements } from '../use-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('relecture des signalements', () => {
  it('la même liste relue est reconnue (aucun recalcul des repères) ; un changement est vu', () => {
    const a = sig({});
    const b = sig({});
    expect(memesSignalements([a, b], [{ ...a }, { ...b }])).toBe(true);
    expect(memesSignalements([a, b], [a])).toBe(false);
    expect(memesSignalements([a], [{ ...a, etat: 'regle' }])).toBe(false);
    expect(memesSignalements([a], [{ ...a, gravite: a.gravite === 'faible' ? 'elevee' : 'faible' }])).toBe(false);
    expect(memesSignalements([a], [{ ...a, latitude: a.latitude + 0.0001 }])).toBe(false);
  });
});
