import { renderHook } from '@testing-library/react-native';

import { useCouches } from '../use-couches';

describe('useCouches', () => {
  it('rend des couches sans chargement ni erreur', async () => {
    const { result } = await renderHook(() => useCouches());
    expect(result.current.chargement).toBe(false);
    expect(result.current.erreur).toBeNull();
    expect(Array.isArray(result.current.couches.chantiers.features)).toBe(true);
  });
});
